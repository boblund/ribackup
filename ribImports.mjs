// Hide NodeJs QuickJS differences for ribackup.mjs

export { execps, spawnAsync, hostname, join, __dirname };

const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
let execps, spawnAsync, hostname, join, __dirname;

if( isNode ){
	const { exec, spawn } = await import( 'child_process' );
	( { hostname } = await import( 'os' ) );
	( { join } = await import ( 'path' ) );
	const { dirname } = await import( 'node:path' );
	const { fileURLToPath } = await import( 'node:url' );
	__dirname = dirname( fileURLToPath( import.meta.url ) );

	execps = function( cmd ){
		return new Promise( res => {
			exec( cmd, ( err, stdout, stderr ) => {
				res( { code: err != null ? err.code : 0, stdout, stderr } );
			} );
		} );
	};

	spawnAsync = function( string ){
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
	};

} else { // presume quickjs
	const { exit, dirname, spawn, Pipe } = await import( 'qjsPlatform' );

	hostname = function() {
		const pipe = new Pipe( "hostname", "r" );
		const ab = pipe.read();
		pipe.close();
		return String.fromCharCode.apply( null, new Uint8Array( ab, 0, ab.byteLength - 1 ) ); //drop \n
	};

	join = function( ...args ) {
		return args
			.filter( Boolean ) // Remove empty or falsy segments
			.join( '/' )
			.replace( /\/+/g, '/' ); // Replace multiple slashes with a single slash
	};

	__dirname = dirname();

	Date.prototype.__toLocaleString = Date.prototype.toLocaleString;
	Date.prototype.toLocaleString = function( arg ) {
		if( arg === 'sv-SE' ) {
			let [ date, time, ampm ] = this.toLocaleString().replace( ',', '' ).split( ' ' );
			let dateParts = date.split( '/' );
			dateParts.unshift( dateParts.pop() );
			let timeParts = time.split( ':' );
			if( ampm === 'PM' ) timeParts[ 0 ] = ( parseInt( timeParts[ 0 ] ) + 12 ).toString();
			return `${ dateParts.join( '-' ) }_${ timeParts.join( ':' ) }`;
		} else {
			return this.__toLocaleString( arg );
		}
	};

	// qjs globals

	globalThis.process = {
		exit,
		stdout: {},
		versions: { quick: true },
		argv: [ '', ...scriptArgs ]
	};

	execps = function( cmd ){
		let pipe = new Pipe( cmd + ' 2>&1', "r" ), stdout = ''; // Pipe global defined in process.c
		return new Promise( res => {
			let outString = '', ab;
			while ( ( ab = pipe.read() ) ) {
				stdout += outString;
				outString += String.fromCharCode.apply( null, new Uint8Array( ab, 0, ab.byteLength ) );
			}
			const code = pipe.close();;
			if( code === 0 ) {
				stdout += outString;
				outString =  '';
			}

			res( { code, stdout, stderr: outString === '' ? outString : outString.replace( '\n', '' ) } );
		} );

	};

	spawnAsync = function( cmd ){
		let exitResolve;
		let pipe = new Pipe( cmd + ' 2>&1', "r" );
		return {
			stdout: {
				pipe(){
					// outString is the last string read and is either stdout or stderr, depending on the close code.
					// All previous strings, if any, are stdout.
					let outString = '', ab;
					while ( ( ab = pipe.read() ) ) {
						console.log( outString );
						outString = String.fromCharCode.apply( null, new Uint8Array( ab, 0, ab.byteLength ) );
					}

					// outString is stdout or stderr if code is 0 or not, respectively.
					const code = pipe.close();
					if( code === 0 ) {
						console.log( outString );
						outString =  '';
					}

					exitResolve( {
						code,
						stderr: outString === '' ? outString : outString.replace( '\n', '' )
					} );
				}
			},
			exit: new Promise( res => { exitResolve = res; } )
		};
	};

}
