// First import of main.ts: catches failures before Nest and its logger exist, so it writes a JSON line itself.
for (const event of ["unhandledRejection", "uncaughtException"] as const) {
  process.on(event, (error: unknown) => {
    const err = error instanceof Error ? error.stack : String(error);
    process.stderr.write(`${JSON.stringify({ level: "fatal", time: Date.now(), msg: event, err })}\n`);
    process.exit(1);
  });
}
