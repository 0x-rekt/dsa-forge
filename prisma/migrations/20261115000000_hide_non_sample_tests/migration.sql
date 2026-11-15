-- Keep the first test case per problem visible as the worked sample and hide
-- every other expected output. The runner already redacts hidden results, but
-- the seeded data marked all 50k+ cases visible, so the browser could read the
-- expected answer for every case. Re-running the seeder applies the same rule.
UPDATE "test_case"
SET "isHidden" = true
WHERE "sortOrder" > 0;
