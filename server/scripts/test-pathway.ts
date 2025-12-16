import { PathwayModule } from '#src/pathway/pathway.module';
import { PathwayService } from '#src/pathway/pathway.service';
import { NestFactory } from '@nestjs/core';
import { CareTaskType } from '@prisma/client';
import { config } from 'dotenv';
config();

async function testPathway() {
  // Create application context without starting the HTTP server
  const app = await NestFactory.createApplicationContext(PathwayModule);

  try {
    // Get PathwayService from the DI container
    const pathwayService = app.get(PathwayService);

    // TODO allow for different care task types when we have more
    const careTaskType = CareTaskType.DEXA_SCAN;

    console.log(`\nTesting pathway for ${careTaskType}...`);

    const results = await pathwayService.test(careTaskType);

    // Print results as a nice table
    console.log('\n' + '='.repeat(88));
    console.log('Test Results:');
    console.log('='.repeat(88));

    // Format table manually to avoid quotes
    const indexWidth = 5;
    const questionWidth = 20;
    const answerWidth = 45;
    const rateWidth = 12;

    // Header
    console.log(
      `${'Index'.padEnd(indexWidth)} | ` +
        `${'Question'.padEnd(questionWidth)} | ` +
        `${'Answer'.padEnd(answerWidth)} | ` +
        `${'Success Rate'.padEnd(rateWidth)}`,
    );
    console.log('-'.repeat(88));

    // Rows
    results.forEach((r, index) => {
      const idx = String(index + 1).padEnd(indexWidth);
      const question = r.question.substring(0, questionWidth).padEnd(questionWidth);
      const answer = r.answer.substring(0, answerWidth).padEnd(answerWidth);
      const rate = `${(r.successRate * 100).toFixed(1)}%`;
      const coloredRate =
        r.successRate >= 0.8
          ? `\x1b[32m${rate}\x1b[0m`
          : r.successRate >= 0.5
            ? `\x1b[33m${rate}\x1b[0m`
            : `\x1b[31m${rate}\x1b[0m`;

      console.log(`${idx} | ${question} | ${answer} | ${coloredRate}`);
    });

    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;

    console.log('='.repeat(88));
    console.log(
      `Total Tests: ${results.length} | Average Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`,
    );
    console.log('='.repeat(88));

    if (avgSuccessRate < 0.8) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error testing pathway:', error);
    process.exit(1);
  } finally {
    // Clean up
    await app.close();
  }
}

void testPathway();
