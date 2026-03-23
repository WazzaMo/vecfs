#!/bin/bash

# Package using @wazamo-agent-tools/packager

## Blank package
atp creaate package skeleton

atp package name "vecfs-ts"
atp package type Mcp
atp package version `cat ../VERSION.txt`
