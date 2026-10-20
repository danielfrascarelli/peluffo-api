import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Role } from "@/common/auth.decorator";
import { EnvNames } from "@/common/config.options";

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  passwordHash: string;
}

export type JsonObject = Record<string, unknown>;

// ponytail: JSON files read once at boot, read-only. Edit the file and restart to change data.
// Move to Prisma when the app needs writes (assignments) or more than one instance.
@Injectable()
export class JsonDataAccessor implements OnModuleInit {
  private users: UserRecord[] = [];
  private data: Record<"patients" | "psychologists" | "assignments", JsonObject[]> = {
    patients: [],
    psychologists: [],
    assignments: [],
  };

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const dir = this.config.getOrThrow<string>(EnvNames.DataDir);
    const load = async <T>(name: string): Promise<T[]> =>
      JSON.parse(await readFile(join(dir, `${name}.json`), "utf8")) as T[];
    [this.users, this.data.patients, this.data.psychologists, this.data.assignments] = await Promise.all([
      load<UserRecord>("users"),
      load<JsonObject>("patients"),
      load<JsonObject>("psychologists"),
      load<JsonObject>("assignments"),
    ]);
  }

  findUserByUsername(username: string): UserRecord | undefined {
    return this.users.find((u) => u.username === username);
  }

  findUserById(id: string): UserRecord | undefined {
    return this.users.find((u) => u.id === id);
  }

  patients(): JsonObject[] {
    return this.data.patients;
  }

  psychologists(): JsonObject[] {
    return this.data.psychologists;
  }

  assignments(): JsonObject[] {
    return this.data.assignments;
  }
}
