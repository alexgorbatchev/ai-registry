mod reviewer 'skills/agent/github-fix-issues/justfile'

# List available commands
default:
    @just --list

# Validate this repository's .cronrc
cron-check:
    cron-person dir check .

# Show authorization and tasks for this repository
cron-status:
    cron-person dir status .

# Preview the managed crontab for all authorized directories
cron-show:
    cron-person crontab show

# Authorize this repository's current .cronrc and install the schedule
cron-enable: cron-check
    cron-person allow .
    cron-person crontab sync

# Refresh the managed crontab without changing authorization
cron-sync:
    cron-person crontab sync

# Revoke this repository's authorization and remove its scheduled tasks
cron-disable:
    cron-person deny .
    cron-person crontab sync

# Print the latest scheduled-update output
cron-logs:
    tail -n 100 .tmp/scheduled-update.log

# Prepare dependencies and generated assets for local development
setup:
    bun install
