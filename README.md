# ribackup

Ribackup does incremental backups using rsync. Two types of backups are supported:
- Incremental backups: Each backup only copies changed files.
- Snapshot-based incremental backups: Each backup is saved as a new snapshot. Each snapshot has all backed up files but only files that are changed from the previous snapshot are copied. [TimeMachine](https://support.apple.com/en-us/104984) is one example of this type.

Backed up files are stored on the backup server in the same structure as on the source. File restoration is a simple matter of copying the desired saved file.

Ribackup runs as a [NodeJS](www.nodejs.org) application or as a [QuickJS](https://bellard.org/quickjs/) generated executable.

# Dependencies

ribackup has the following system requirements:
- [Rsync](https://rsync.samba.org/) and [ssh](https://www.ssh.com/academy/ssh/) must be available on the source server being backed up and the backup server where the backups are stored.
- [NodeJS](https://nodejs.org) must be installed on the source server. Also on the backup server if verifying files is desired.
- [QuickJS](https://bellard.org/quickjs/) version 2025-04-26 (and possibly newer) if desired.
- Snapshot-based requires that the backup server file system support hard links.
- While not required, some scheduled command capability, such as [cron](https://en.wikipedia.org/wiki/Cron) or [launchctl](https://ss64.com/mac/launchctl.html), can be used to automate backups.

# Installing
Clone this repo.
```
git clone https://github.com/boblund/ribackup.git
cd ribackup
```
The file ```ribackup.mjs``` can be left where it is or copied to any other directory.

Install [QuickJS](https://bellard.org/quickjs/), if needed, as described in the documentation. Then:
```
cd quickjs
make
```
Copy the ```ribackup``` to the desired directory. See the quickljs/README.md for additional details about how ribackup works with QuickJS.
## Fill in backup template
```backupConfig.js``` is the backup template that defines the information used for backups. Once filled in, it should be named \<computer-name\>.backupConfig.mjs and saved in the same directory as ```ribackup.mjs```. \<computer-name\> is the source server name, e.g. hostname on linux or system settings -> general -> about -> name on OSX.

## Set up SSH key authentication
```ribackup.mjs``` uses ssh to execute commands on the backup server. Key authentication should be set up so that the username and password is not required when doing a backup.

If ssh is not set up on the source server, do:

```
ssh-keygen
```

Set an empty pass code when prompted.

Distribute the public key (either the existing one or the new one created by ```ssh-keygen```) to the backup server:

```
ssh-copy-id <public-key-path> <sshDest field in backupConfig.js>
```

Detailed instructions for creating and distributing the ssh key can be found [here](https://www.ssh.com/academy/ssh/copy-id).

## Test backup (recommended)
Do a dry run of the backup that shows which files would be backed up:
```
node <path_to_ribackup>/ribackup.mjs --dry-run
```
## Set up automatic execution
Any available method to automatically run ```ribackup.mjs``` can be used. Below are two examples using cron and launch agents (Mac OSX).
### cron
This example crontab entry will run ```ribackup.mjs``` at 1:00am everyday and record backed up files (in log) and errors (err).
```
0 1 * * * /usr/local/bin/node <path_to_ribackup>/ribackup.mjs > /tmp/ribackup.log 2>/tmp/ribackup.err
```
### launchctl
The equivalent launch agent can be used on a Mac instead of cron by putting the following in a plist file stored at ```~/Library/LaunchAgents/com.username.ribackup.plist```.
```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.username.ribackup.plist</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string><path_to_ribackup>/ribackup.mjs</string>
  </array>

  <key>StandardOutPath</key>
  <string>/tmp/ribackup.log</string>

  <key>StandardErrorPath</key>
  <string>/tmp/ribackup.err</string>

  <key>Nice</key>
  <integer>1</integer>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>1</integer>

    <key>Minute</key>
    <integer>0</integer>
  </dict>
</dict>
</plist>
```
Then, load the plist:
```
launchctl bootstrap gui/${UID} ~/Library/LaunchAgents/com.username.ribackup.plist
```
The plist can be unloaded with:
```
launchctl bootout gui/${UID} ~/Library/LaunchAgents/com.username.ribackup.plist
```
Any changes to the plist requires bootout followed by bootstrap for the new plist to be loaded. Older OSX versions may use load and unload (without the gui/${UID} parameter) instead of bootstrap and bootout.
# Verifying backups
Backups can be verified any time by comparing hashes of the files on the source and backup servers. **NOTE:** verification is only required to detect bit errors that can occur over time.

First, on backup server:

Make sure NodeJS is installed.

```
cp createHashes.mjs /usr/local/bin/createHashes.mjs
chmod 755 /usr/local/bin/createHashes.mjs
```
**NOTE:** createHashes.mjs can be put in any directory that is in $PATH.

On the source server do:
```
node verifyHashes.mjs 2>/tmp/verifyHashes.err
```
This will cause the backup server to generate a stream of (file, hash) tuples to the source server where they will be compared to the equivalent source (file, hash). Stdout is a progress indicator showing the number of files compared and elapsed time in seconds. Stderr shows:
- Backup files no longer on the source. This can happen when doing snapshot-incremental backups and deleting the source file.
- Files with hash mismatches between the source and backup.
# License

Software license: Creative Commons Attribution-NonCommercial 4.0 International

**THIS SOFTWARE COMES WITHOUT ANY WARRANTY, TO THE EXTENT PERMITTED BY APPLICABLE LAW.**
