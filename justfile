mod registry-cli 'packages/registry-cli/justfile'
mod template-resolver 'packages/template-resolver/justfile'
mod session-analysis 'packages/opencode-session-analysis/justfile'
mod disk-cleanup 'skills/user/disk-cleanup/justfile'
mod claude-code-hooks 'harnesses/claude-code/hooks/justfile'
mod ux-flow-redesign 'skills/agent/ux-flow-redesign/justfile'

# List available commands
default:
    @just --list --list-submodules

# Install dependencies and point Git at the checked-in hooks
setup:
    bun install
    just registry-cli install-git-hooks

# Type check every TypeScript source in the repository
typecheck:
    bun run tsc -p tsconfig.json

# Type check, then build generated harness outputs; pass -y to confirm prompts
[positional-arguments]
build *args: typecheck
    just registry-cli build "$@"

# Install dependencies, build, and apply generated outputs to harness homes
[positional-arguments]
bootstrap *args:
    just registry-cli bootstrap "$@"

# Validate the bootstrap flow against .tmp/bootstrap-smoke/
bootstrap-smoke:
    just registry-cli bootstrap-smoke

# Pull, bootstrap, and push under the scheduled-update lock
scheduled-update:
    just registry-cli scheduled-update

# Refresh the checked-in OpenCode docs snapshot
sync-opencode-docs:
    just registry-cli sync-opencode-docs

# Vendor an external skill: just skills-add 'npx skills add <source> --skill <name>'
[positional-arguments]
skills-add *args:
    just registry-cli skills-add "$@"

# List the skills the Skills CLI finds in this repository
skills-list:
    npx skills add . --list

# Refresh vendored external skills, then rebuild
skills-update:
    just registry-cli skills-update
    just build

# Run the registry CLI and Claude Code hooks coverage gates
coverage:
    just registry-cli coverage
    just claude-code-hooks coverage

# Run every package's tests
test:
    just registry-cli test
    just template-resolver test
    just session-analysis test
    just disk-cleanup test
    just claude-code-hooks test
    just ux-flow-redesign test

# Apply formatting in every package
fmt:
    just registry-cli fmt
    just template-resolver fmt
    just session-analysis fmt
    just disk-cleanup fmt
    just claude-code-hooks fmt
    just ux-flow-redesign fmt

# Apply lint fixes and formatting in every package
fix:
    just registry-cli fix
    just template-resolver fix
    just session-analysis fix
    just disk-cleanup fix
    just claude-code-hooks fix
    just ux-flow-redesign fix

# Validate without modifying source files
check: typecheck
    just registry-cli check
    just template-resolver check
    just session-analysis check
    just disk-cleanup check
    just claude-code-hooks check
    just ux-flow-redesign check

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
    tail -n 100 .state/scheduled-update.log

# Evaluate shared communication instructions against synthetic reply cases
[positional-arguments]
reply-eval *args:
    uv run --no-project python docs/internal/references/reply-eval/run.py "$@"

# Check the reply graders offline
reply-eval-test:
    uv run --no-project python -B -m unittest discover -s docs/internal/references/reply-eval -p 'test_*.py'

# Render all recorded reply trials as an offline HTML report
reply-eval-report:
    uv run --no-project python docs/internal/references/reply-eval/render_report.py
