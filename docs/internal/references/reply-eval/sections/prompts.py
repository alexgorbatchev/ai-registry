"""Construct section experiments from the exact archived production source."""

import argparse
import hashlib
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVISION = "65c2fa37ed5ebb3e88c5412122c66e25fafaf32b"
DIGEST = "088877ac92777d36159a845e20bb2cd01014535138b0b19b4d38179be1517225"
BLOCKS = (
    "personality",
    "audience",
    "pages",
    "operating",
    "git",
    "recovery",
    "integrity",
    "diligence",
)
HEADINGS = (
    "Operating Instructions",
    "Git Authorization",
    "Failure Investigation and Recovery",
    "Implementation Integrity",
    "Due Diligence",
    "Sending the reply",
)


def build():
    source = subprocess.check_output(["git", "show", f"{REVISION}:system/system.md"])
    if hashlib.sha256(source).hexdigest() != DIGEST:
        raise ValueError("Unexpected production source")
    deployed = source.decode()
    body, *sections = deployed.removeprefix("# Communication\n\n").split("\n# ")
    assert [s.splitlines()[0] for s in sections] == list(HEADINGS)
    personality, rest = body.split("Assume the user", 1)
    audience, rest = ("Assume the user" + rest).split("Use TLDR", 1)
    legacy, pages = ("Use TLDR" + rest).split("Put every question", 1)
    blocks = dict(
        zip(
            BLOCKS,
            [
                personality,
                audience,
                "Put every question" + pages,
                *["# " + s for s in sections[:-1]],
            ],
        )
    )
    rules_file = HERE.parent / "tuning/v3.md"
    if (
        hashlib.sha256(rules_file.read_bytes()).hexdigest()
        != "7fe3608ddef00bf2c5f288351ac00e5934528863d9dcbeb615c3a08d4e7c96e0"
    ):
        raise ValueError("Isolated revision 3 has changed")
    rules = rules_file.read_text()
    examples = "# " + sections[-1]

    def compose(selected):
        parts = [blocks[k] for k in BLOCKS[:2] if k in selected] + [rules]
        parts.extend(blocks[k] for k in BLOCKS[2:] if k in selected)
        return "\n\n".join(p.strip() for p in parts) + "\n"

    prompts = {
        "v3": rules,
        "deployed": deployed,
        "all": compose(BLOCKS),
        "workflow-only": compose(BLOCKS[3:]),
        "communication-only": compose(BLOCKS[:3]),
        "examples": rules.rstrip() + "\n\n" + examples,
        "old-rules": legacy.strip() + "\n\n" + examples,
    }
    prompts["rules-last"] = (
        "\n\n".join([*(blocks[k].strip() for k in BLOCKS), rules.strip()]) + "\n"
    )
    prompts["deployed-without-examples"] = deployed.removesuffix(examples)
    for name in BLOCKS:
        text = blocks[name].strip()
        assert deployed.count(text) == 1
        prompts["deployed-without-" + name] = deployed.replace(text + "\n\n", "", 1)
        prompts[name] = compose([name])
        prompts["without-" + name] = compose(set(BLOCKS) - {name})
    operating = "Apply this section when carrying out authorized work. For a question or a draft based on supplied facts, answer from that record. Keep work tracking in the task record; bring it into the reply when requested or when the user needs it to act."
    recovery = "Use the investigation and retry procedure below when handling a failure in authorized work or when the user requests a diagnosis. For a status or evidence question, give the supported finding and any material limit. Include a diagnostic procedure when the user asks how to verify or recover."
    for name, edits in (
        ("scope-ops", [(HEADINGS[0], operating)]),
        ("scope-failure", [(HEADINGS[2], recovery)]),
        ("scope-both", [(HEADINGS[0], operating), (HEADINGS[2], recovery)]),
    ):
        candidate = deployed
        for heading, boundary in edits:
            marker = f"# {heading}\n\n"
            candidate = candidate.replace(marker, marker + boundary + "\n\n", 1)
        prompts[name] = candidate
    return prompts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    directory = parser.parse_args().directory
    directory.mkdir(parents=True, exist_ok=True)
    for name, content in build().items():
        (directory / (name + ".md")).write_text(content)
