-- The first seeder synthesized `approach` and `complexity` chunks from templates
-- because the upstream dataset has no such fields. The tutor already filters
-- them, but keyword and vector search still ranked them. Delete only the exact
-- template text so any genuine editorial content is preserved. The seeder no
-- longer creates them, so a fresh database is already clean.
DELETE FROM "problem_chunk"
WHERE (
    "section" = 'approach'
    AND "content" LIKE '%pattern to transform the problem statement into a solution.%'
  )
  OR (
    "section" = 'complexity'
    AND "content" LIKE '%Complexity depends on the constraints and the chosen implementation.%'
  );
