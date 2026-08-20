# Baibot: Mistral AI Integration for Matrix Homeservers

## 📌 How to Plug Mistral AI into Matrix (via Baibot)

---

### 1. Quick Start Commands
To create a **Mistral-powered agent** in a Matrix room:
```plaintext
!bai agent create-room-local mistral my-mistral-agent
```

Or for a **global agent** (available in all rooms):
```plaintext
!bai agent create-global mistral my-mistral-agent
```

---

### 2. Sample Configuration
Baibot provides a **pre-configured template** for Mistral in:
📄 [`docs/sample-provider-configs/mistral.yml`](https://github.com/stonehold76/baibot/blob/main/docs/sample-provider-configs/mistral.yml)

**Default config:**
```yaml
base_url: https://api.mistral.ai/v1
api_key: YOUR_API_KEY_HERE  # Replace with your Mistral API key
text_generation:
  model_id: mistral-large-latest  # Default model
  prompt: "You are a brief, but helpful bot called {{ baibot_name }} powered by the {{ baibot_model_id }} model. The date/time of this conversation's start is: {{ baibot_conversation_start_time_utc }}."
  temperature: 1.0
  max_response_tokens: 4096
  max_context_tokens: 128000
```

---

### 3. Provider Details
- **🔹 Identifier:** `mistral`
- **🌐 Homepage:** [mistral.ai](https://mistral.ai/)
- **📝 Sign Up:** [auth.mistral.ai/ui/registration](https://auth.mistral.ai/ui/registration)
- **📋 Models List:** [docs.mistral.ai/getting-started/models](https://docs.mistral.ai/getting-started/models/)
- **✅ Capabilities:** Text generation (no vision/tools yet).

---

### 4. Steps to Set Up
1. **Sign up** for a Mistral AI account at [auth.mistral.ai](https://auth.mistral.ai/ui/registration).
2. **Get an API key** from your Mistral dashboard.
3. **Create an agent** in Baibot using the commands above.
4. **Configure the agent** with your API key (Baibot will prompt you for it).
5. **Set the agent as a handler** for text generation (Baibot will guide you).

---

### 5. Notes
- Baibot **automatically shows** the sample config when you create a Mistral agent.
- The config supports **templating** (e.g., `{{ baibot_name }}`, `{{ baibot_model_id }}`).
- Mistral’s **base URL** is hardcoded to `https://api.mistral.ai/v1` (see [src/agent/provider/mistral/mod.rs](https://github.com/stonehold76/baibot/blob/main/src/agent/provider/mistral/mod.rs)).

---

### 🔗 Useful Links
- [Full Providers Doc](https://github.com/stonehold76/baibot/blob/main/docs/providers.md)
- [Mistral Sample Config](https://github.com/stonehold76/baibot/blob/main/docs/sample-provider-configs/mistral.yml)
- [Mistral Provider Code](https://github.com/stonehold76/baibot/blob/main/src/agent/provider/mistral/mod.rs)
