#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("elmar")
  .description("Personal knowledge & productivity system")
  .version("0.1.0");

program.parse();
