# Isolated TLDR and ID tuning

Only the experimental reply instructions vary. Both providers use their native base instructions, the isolated instruction-file verifier and medium effort. Opus runs through `cl-envoy`. The full shared prompt stays deployed.

The development suite is the six-case transfer set from the preceding ablation. Each comparison generates two new replies per arm, model and case. A blind Astra reviewer sees shuffled responses from both arms and models and grades completeness, concision and addressability. A pass requires all three. Mechanical checks run separately.

Choose the candidate with the most passes on the weaker model, using preserved ID behavior and completeness to decide close results. Check the selected prompt against the original isolated prompt on eight previously unused cases frozen before inspecting the first development results. An exploratory target for the fresh run is at least 14/16 passes per model with all explicit ID contracts preserved. A miss on this target is reported separately from comparative improvement. The cases simulate history within each request.
