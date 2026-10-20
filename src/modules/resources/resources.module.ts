import { Module } from "@nestjs/common";
import { ResourcesController } from "@/modules/resources/resources.controller";

@Module({ controllers: [ResourcesController] })
export class ResourcesModule {}
