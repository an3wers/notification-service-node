import { config } from "./config/env.ts";
import { app } from "./server.ts";

app.listen(config.port, () => {
  console.log(`Email server is running on port ${config.port}`);
});
