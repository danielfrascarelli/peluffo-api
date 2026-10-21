import { Global, Module } from "@nestjs/common";
import { GoogleSheetsAccessor } from "@/data/google-sheets.accessor";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { SessionAccessor } from "@/data/session.accessor";

@Global()
@Module({
  providers: [JsonDataAccessor, SessionAccessor, GoogleSheetsAccessor],
  exports: [JsonDataAccessor, SessionAccessor, GoogleSheetsAccessor],
})
export class DataModule {}
