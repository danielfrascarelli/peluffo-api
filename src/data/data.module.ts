import { Global, Module } from "@nestjs/common";
import { JsonDataAccessor } from "@/data/json-data.accessor";
import { SessionAccessor } from "@/data/session.accessor";

@Global()
@Module({
  providers: [JsonDataAccessor, SessionAccessor],
  exports: [JsonDataAccessor, SessionAccessor],
})
export class DataModule {}
