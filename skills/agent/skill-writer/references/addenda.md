Create a project-local `<base-skill>-addendum` for project-specific changes to an existing skill. Keep only the delta; do not copy the base skill. Create at most one addendum per base skill in a project.

Use this exact description so routing can discover the dependency before loading the body:

> If <base-skill> skill is used, this skill must be used as well.

State in the body that the addendum supersedes conflicting base-skill guidance for that project. Keep the global base skill independent of project-local addenda; do not add references to them in the base skill.
