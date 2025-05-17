#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { hostname } from 'os';
import { join } from 'path';

const { retentionSchedule, includeExclude, sourceDir, sshDest, backupsLoc } = await import( `./${ hostname().replace( '.local', '' ) }.backupConfig.mjs` );
const args = process.argv.slice( 2 );
let backupDir = join( backupsLoc, hostname().replace( '.local', '' ) );
let backupPath =  sshDest + ':' + backupDir;
let snapshotName = '';

const usage = `piBackup [ --help | [ --dry-run | --snapshot name ] ]`;

const backupConfig = new class {
	#backupData = [];
	constructor( backupretentionSchedule ){
		this.#backupData = [ ...backupretentionSchedule ];
		for( let i = 0; i < this.#backupData.length; i++ ){
			this.#backupData[ i ].cumNumber = i == 0 ? this.#backupData[ i ].number : this.#backupData[ i ].number + this.#backupData[ i - 1 ].cumNumber;
			this.#backupData[ i ].cumAge = i == 0
				? this.#backupData[ i ].number * this.#backupData[ i ].length
				: this.#backupData[ i ].number * this.#backupData[ i ].length + this.#backupData[ i - 1 ].cumAge;
		}
	}

	firstGrp( idx ){ return this.#idxToGrp( idx ) === 0; }

	#idxToGrp( idx ){
		return [ ...this.#backupData ].reduce( ( acc, e, i, a ) => {
			if( idx < ( acc += e.number ) ) a.splice( 0 );  // cause early exit of reduce
			return a.length === 0 ? i : acc;
		}, 0 );
	}

	get isTM(){ return this.#backupData.length > 0 ? true : false; }
	get maxAge(){ return this.#backupData[ this.#backupData.length - 1 ].cumAge; }

	minAge( idx ){
		const prevGrpIdx = this.#idxToGrp( idx ) - 1;
		return prevGrpIdx === -1
			? idx
			: this.#backupData[ prevGrpIdx ].cumAge + ( idx - this.#backupData[ prevGrpIdx ].cumNumber  )  * this.#backupData[ this.#idxToGrp( idx ) ].length;
	}
}( retentionSchedule );

function epochDay( snapshotName ){
	// returns Epoch time in days. Epoch is measured in UTC so adjust 'snapshotName' date by local timezone offset
	const date = new Date( snapshotName.replace( '_', ' ' ) );
	return Math.floor( date.getTime() / ( 1000 * 3600 * 24 ) - date.getTimezoneOffset() / ( 60 * 24 ) );
}

function execps( cmd ){
	return new Promise( res => {
		exec( cmd, ( err, stdout, stderr ) => {
			res( { code: err != null ? err.code : 0, stdout, stderr } );
		} );
	} );
}

function spawnAsync( string ){
	let r = '';
	const [ cmd, ...args ] = string.match( /(".*?"|'.*?'|\S+)/g ).map( e => e.replace( /['"](.*?)['"]/, "$1" ) );
	const child = spawn( cmd, args );
	child.stderr.on( 'data', chunk => { r += chunk; } );
	return {
		stdout: child.stdout,
		stdin: child.stdin,
		exit: new Promise( res => {
			child.on( 'close', code => {
				res( { code, stderr: r } );
			} );
		} )
	};
}

const rsyncCmd = 'rsync -azv --delete';
let dryRun = '';

while( args.length > 0 ) {
	switch( args[0] ){
  	case '--dry-run':
			dryRun = '--dry-run';
			args.shift();
			break;

		case '--snapshot':
			args.shift();
			snapshotName = args[0];
			args.shift();
			break;

		case '--help':
			console.log( `${ usage }` );
			process.exit( 0 );

		default:
			console.log( `${ usage }` );
			process.exit( 1 );
	}
}

if( !backupConfig.isTM ){
	// not timemachine-like backup
	const { stdout, exit } = await spawnAsync( `${ rsyncCmd } --delete ${ dryRun } ${ includeExclude } ${ sourceDir } ${ backupPath }${ sourceDir }` );
	stdout.pipe( process.stdout );
	const { code, stderr } = await exit;
	if( code !== 0 ) console.error( `Error code: ${ code }${ stderr }` );
	process.exit( code );
} else {
	// timemachine-like backup
	snapshotName = snapshotName != '' ? snapshotName : ( new Date().toLocaleString( 'sv-SE' ) ).replace( ' ', '_' );
	const snapshotEpoch = epochDay( snapshotName );
	backupPath = join( backupPath, snapshotName );
	let linkDest = '';

	if( isNaN( snapshotEpoch ) ){
		console.error( 'snaptshot time not valid' );
		process.exit( 1 );
	}

	if( ( await execps( `ssh ${ sshDest } ls -d ${ backupDir }/latest 2>&1` ) ).code === 0 ){
		linkDest = `--link-dest=${ backupDir }/latest`;
	}

	const { stdout, exit } = await spawnAsync( `${ rsyncCmd } ${ dryRun } ${ linkDest } ${ includeExclude } ${ sourceDir } ${ backupPath }` );
	stdout.pipe( process.stdout );
	const { code, stderr } = await exit;

	if( code === 0 ){
		if( dryRun === '--dry-run' ){
			process.exit( 0 );
		}
		const r = await execps( `ssh ${ sshDest } ls ${ backupDir }` );
		const backups = r.stdout.split( '\n' ).filter( ( name ) => name[ 0 ] === '2' ).sort( ( a, b ) => b > a ? 1 : b < a ? -1 : 0 );

		if( linkDest != '' ){
			await execps( `ssh ${ sshDest } rm ${ backupDir }/latest` );
		}
		await execps( `ssh ${ sshDest } ln -s ${ backupDir }/${ snapshotName } ${ backupDir }/latest` );

		// Remove expired snapshots
		( async function(){
			let idx, nextNewestCnt;

			// Keep all current day snapshots
			if( backups.length == 1 || snapshotEpoch == epochDay( backups[ 1 ] ) ){
				return;
			}

			// Keep newest of group that is next newest (which is all of previous day snapshots)
			for( idx = 2, nextNewestCnt = 0; idx < backups.length && epochDay( backups[ 1 ] ) === epochDay( backups[ idx ] ); nextNewestCnt++, idx++ ) {
				await execps( `ssh ${ sshDest } rm -rf ${ backupDir }/${ backups[ idx ] }` );
			};
			backups.splice( 2, nextNewestCnt );

			// Check that snapshots meet the minimum age for their new idx, i.e. previous backup idx + 1.
			for( idx = 0; idx < backups.length; idx++ ){
				const snapshotAge = snapshotEpoch - epochDay( backups[ idx ] );
				if( snapshotAge < backupConfig.maxAge ){
					if( snapshotAge < backupConfig.minAge( idx ) ){
						// Snapshot age is less than the minimum age for backups[idx]. Delete the previous newer snapshot. This effectively
						// keeps the oldest snapshot allowed at this idx. Eventually it will be old enough for the next idx.
						await execps( `ssh ${ sshDest } rm -rf ${ backupDir }/${ backups[ backupConfig.firstGrp( idx ) ? idx : idx - 1 ] }` );
						return; // Older snapshots are still at their previous idx and presumably still meet the min age requirement.
					}
				} else {
					await execps( `ssh ${ sshDest } rm -rf ${ backupDir }/${ backups[ idx ] }` );
				}
			}
		} )();
		console.log( `backup to ${ backupPath } successfull` );
	} else {
		console.error( `rsync failed: code: ${ code } ${ stderr }` );
		await execps( `ssh ${ sshDest } rm -rf ${ backupDir }/${ snapshotName }` );
	}
}
