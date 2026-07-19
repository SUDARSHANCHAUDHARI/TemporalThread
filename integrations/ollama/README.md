# Ollama integration

Ollama is a model runtime, not an MCP host. TemporalThread therefore provides `examples/ollama-tool-client`, which:

- starts TemporalThread over MCP stdio;
- converts the MCP tool schemas to Ollama function tools;
- executes requested MCP calls and returns `tool` messages;
- keeps one local conversation identifier for the process.

Set `OLLAMA_MODEL` to an installed tool-capable model, make sure the local Ollama service is running, then run `node examples/ollama-tool-client/dist/index.js "How long has it been?"` after building the workspace. Set `OLLAMA_CONVERSATION_ID` to reuse a conversation identifier across runs. No request is sent anywhere except the locally configured Ollama endpoint (default `http://127.0.0.1:11434`). Installing TemporalThread does not modify other Ollama clients.

Reference: [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling) and [chat API](https://docs.ollama.com/api/chat).
