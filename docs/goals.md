# Goals for VecFS

VecFS is short for Vector File System or Spec - it's both.

# Intro

Imagine being able to give your AI agent long-term memory by storing context locally in a manner most efficent and available for Agents. This could allow agents to learn and improve over time because they might recall past mistakes.

# Objectives

VecFS should provide a local file that is simple to operate, back-up
and maintain and allow everyday users to extend the learning and memory
of their AI agents in a simple way, without the complexity of running
vector databases with extensive storage.

# How can this be achieved?

Model Context Protocol allows for the integration of context into
AI Agent tools. Vector Databases are typically too large to run on
a laptop but you don't need all the dimensions in a vector DB all the time.

A natural compression can be achieved with right-sized thinking in the mix.

# Experiment

That hypothesis is that we can help agents be more useful and more efficient
with long-term recall AND that a vector information system does not need
all the dimensions for all of the objects all of the time.

The inspiration for the natural data compression is Look Up Tables (LUTs)
in older image file formats for systems that could not express 
all of the colours all of the time because there were too many bits per pixel.

# Fundamental principle

You don't need to store zeros.

Allow the vector space to be dynamic and declarative and for each vector
to indicate the dimensions, where it has non-zero values, leaving others
as implicitly zero.
