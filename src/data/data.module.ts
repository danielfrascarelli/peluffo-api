import { Global, Module } from "@nestjs/common";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { SessionAccessor } from "@/data/session.accessor";
import { ExtractionSnapshotAccessor } from "@/data/extraction-snapshot.accessor";

@Global()
@Module({
  providers: [JsonDataAccessor, SessionAccessor, GoogleSheetsAccessor, ExtractionSnapshotAccessor],
  exports: [JsonDataAccessor, SessionAccessor, GoogleSheetsAccessor, ExtractionSnapshotAccessor],
})
export class DataModule {}
