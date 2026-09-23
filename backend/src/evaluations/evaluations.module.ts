import { Module } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service.js';
import { EvaluationsController } from './evaluations.controller.js';
import { StudentsProgressionController } from './students.controller.js';
import { ChildrenProgressionController } from './children.controller.js';

@Module({
  controllers: [
    EvaluationsController,
    StudentsProgressionController,
    ChildrenProgressionController,
  ],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}