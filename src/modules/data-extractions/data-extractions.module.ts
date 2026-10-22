import { Module } from "@nestjs/common";
import { DataExtractionsController } from "@/modules/data-extractions/data-extractions.controller";
import { DataExtractionsService } from "@/modules/data-extractions/data-extractions.service";

@Module({ controllers: [DataExtractionsController], providers: [DataExtractionsService] })
export class DataExtractionsModule {}
