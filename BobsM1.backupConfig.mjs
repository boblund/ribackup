export { retentionSchedule, includeExclude, sourceDir, sshDest, backupsLoc };

// ssh-style host for backups
const sshDest = 'pi@pi4.local';

// directory for this machines backup's on sshDest
const backupsLoc = '/media/toshiba1t/backups';

// Root for backup on source machine
const sourceDir = '/';

// Rsync-style directories/files to include/exclude
const	includeExclude = [
	'--include /Users',
	'--include /Users/blund',
	'--exclude node_modules',
	'--exclude .DS_Store',
	'--include .nanorc',
	'--include .profile',
	'--include .ssh/***',
	'--include Desktop/***',
	'--include Music/***',
	'--include "Calibre Library/***"',
	'--exclude "Documents/Microsoft User Data"',
	'--include Documents/***',
	'--exclude "Pictures/Photos Library.photoslibrary"',
	'--include Pictures/***',
	'--exclude *'
].reduce( ( a, e ) => a += `${ e } `, '' );

// Retention strategy: empty means incremental, non-empty is a schedule for snapshot-incremental.
// If snapshot-incremental, every backup on the current day is saved until the end of the day, at which point
// only the newest one for the current day is saved; all others are deleted. All other snapshots are saved as described
// by the retentionSchedule (see example below).

const  retentionSchedule = [ // Entries required to be in chronological order (newest to oldest)
	{ number: 7, length: 1 },  // 7 daily - first group must be daily, i.e. length == 1
	{ number: 3, length: 7 },  // 3 weekly
	{ number: 12, length: 28 } // 12 quad-weekly
];
