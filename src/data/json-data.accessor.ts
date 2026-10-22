import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Role } from "@/common/auth.decorator";
import { EnvNames } from "@/common/config.options";
import { ExtractionSnapshotAccessor } from "@/data/extraction-snapshot.accessor";
import {
  emptyResources,
  type Resources,
  type Patient,
  type Psychologist,
  type Assignment,
} from "@/data/resources.types";

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

// Users load only at boot; resource snapshots can be replaced after an extraction commits.
@Injectable()
export class JsonDataAccessor implements OnModuleInit {
  private users: UserRecord[] = [];
  private data: Resources = emptyResources();

  constructor(
    private readonly config: ConfigService,
    private readonly snapshots: ExtractionSnapshotAccessor,
  ) {}

  async onModuleInit(): Promise<void> {
    const dir = this.config.getOrThrow<string>(EnvNames.DataDir);
    [this.users, this.data] = await Promise.all([
      readFile(join(dir, "users.json"), "utf8").then((value) => JSON.parse(value) as UserRecord[]),
      this.snapshots.loadActive(),
    ]);
  }

  findUserByUsername(username: string): UserRecord | undefined {
    return this.users.find((u) => u.username === username);
  }

  findUserById(id: string): UserRecord | undefined {
    return this.users.find((u) => u.id === id);
  }

  patients(): Patient[] {
    return this.data.patients;
  }

  psychologists(): Psychologist[] {
    return this.data.psychologists;
  }

  assignments(): Assignment[] {
    return this.data.assignments;
  }

  current(): Resources {
    return this.data;
  }

  replace(resources: Resources): void {
    this.data = resources;
  }
}
