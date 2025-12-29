// LLM Generated, don't take it too seriously

import { NestFactory } from '@nestjs/core';
import { PathwayModule } from '../src/pathway/pathway.module';
import { PathwayService } from '../src/pathway/pathway.service';
import { CareTaskType } from '@ca/prisma';
import getBlandPathwayID from '#src/pathway/providers/bland-ai/getBlandPathwayID';

import { config } from 'dotenv';
config();

async function pushPathway() {
  // Get careTaskType from command line arguments
  const careTaskTypeArg = process.argv[2]?.toUpperCase();

  let careTaskTypes: CareTaskType[];

  if (!careTaskTypeArg) {
    // If no care task type specified, push all of them
    console.log('No care task type specified. Pushing pathways for all types...');
    careTaskTypes = Object.values(CareTaskType);
  } else {
    // Validate careTaskType
    if (!Object.values(CareTaskType).includes(careTaskTypeArg as CareTaskType)) {
      console.error(`Error: Invalid care task type: ${careTaskTypeArg}`);
      console.log('Available types:', Object.values(CareTaskType).join(', '));
      process.exit(1);
    }
    careTaskTypes = [careTaskTypeArg as CareTaskType];
  }

  // Create application context without starting the HTTP server
  const app = await NestFactory.createApplicationContext(PathwayModule);

  try {
    // Get PathwayService from the DI container
    const pathwayService = app.get(PathwayService);

    const results: { type: CareTaskType; success: boolean; error?: string; skipped?: boolean }[] =
      [];

    // Loop through all care task types
    for (const careTaskType of careTaskTypes) {
      // Check if this care task type has a pathway ID
      const pathwayID = getBlandPathwayID(careTaskType);

      if (!pathwayID) {
        console.log(`⊘ Skipping ${careTaskType} (no pathway ID configured)`);
        results.push({ type: careTaskType, success: true, skipped: true });
        continue;
      }

      console.log(`\nPushing pathway for ${careTaskType}...`);

      try {
        // Call the push function
        const result = await pathwayService.push(careTaskType);

        if (result.success) {
          console.log(`✓ Successfully pushed pathway for ${careTaskType}`);
          results.push({ type: careTaskType, success: true });
        } else {
          console.error(`✗ Failed to push pathway for ${careTaskType}`);
          results.push({ type: careTaskType, success: false });
        }
      } catch (error) {
        console.error(`✗ Error pushing pathway for ${careTaskType}:`, error);
        results.push({
          type: careTaskType,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log('='.repeat(50));
    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success).length;

    results.forEach((result) => {
      const status = result.skipped ? '⊘' : result.success ? '✓' : '✗';
      const message = result.skipped
        ? 'Skipped (no pathway ID)'
        : result.success
          ? 'Success'
          : 'Failed';
      console.log(`${status} ${result.type}: ${message}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    console.log('='.repeat(50));
    console.log(
      `Total: ${results.length} | Success: ${successCount} | Skipped: ${skippedCount} | Failed: ${failCount}`,
    );

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error pushing pathway:', error);
    process.exit(1);
  } finally {
    // Clean up
    await app.close();
  }
}

pushPathway();
