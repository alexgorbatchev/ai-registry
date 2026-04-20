---
created_on: "2026-04-19 17:41"
source_url: "https://docs.mistral.ai/models/best-practices/prompt-engineering"
title: "Prompting"
provider: "mistral"
published: "unavailable"
date_status: "unavailable"
source_date: "unavailable"
source_date_type: "unavailable"
date_note: "Mistral's fetched docs content did not expose a stable per-page publish or update date."
downloaded_at: "2026-04-19"
---

# Prompting

When you first start using Mistral models, your initial interaction will revolve around **prompts**. Mastering the art of crafting effective prompts is essential for generating high-quality responses from Mistral models or other LLMs.

Main Concepts

Copy section link
# Main Concepts

### The Art of Crafting Prompts

Below, we cover the core concepts of prompting and how to craft effective prompts to maximize the capabilities of our models.

System Prompt

Copy section link
## System Prompt

 When providing instructions, there are two levels of input you can give the model: `system` and `user`.
*   The **`system` prompt** is provided at the beginning of the conversation. It sets the general context and instructions for the model’s behavior and is typically managed by the developer.
*   The **`user` prompt** is provided during the conversation to give the model specific context or instructions for the current interaction.

note

As a developer, you can still use `user` prompts to provide additional context or instructions during the conversation if needed. If you cannot control the `system` prompt, you can still include the general context and instructions in the `user` prompt by concatenating them with the actual query. **Role-Separated Example:**

```
{
    "role": "system",
    "content": "system_prompt"
},
{
    "role": "user",
    "content": "user_prompt"
}
```

```
{
    "role": "system",
    "content": "system_prompt"
},
{
    "role": "user",
    "content": "user_prompt"
}
```

**Concatenated Example:**

```
{
    "role": "user",
    "content": "system_prompt\n\nUser: user_prompt"
}
```

```
{
    "role": "user",
    "content": "system_prompt\n\nUser: user_prompt"
}
```

Providing a Purpose

Copy section link
## Providing a Purpose

 Also called Roleplaying, it's the first step in crafting a prompt and corresponds to defining a **clear purpose**. A common approach is to start with a concise role and task definition, such as: _"You are a <role>, your task is to <task>."_ This simple yet powerful technique helps steer the model toward a specific vertical and task, ensuring it quickly understands the context and expected output.

Structure

Copy section link
## Structure

 When giving instructions, **organize them hierarchically or with a clear structure**, such as dividing them into clear sections and subsections. **The prompt should be clear and complete.** A useful rule of thumb is to **imagine you’re writing for someone with no prior context**—they should be able to understand and execute the task solely by reading the prompt. Example of a Well-Structured Prompt:

```
You are a language detection model, your task is to detect the language of the given text.
# Available Languages
Select the language from the following list:
- English: "en"
- French: "fr"
- Spanish: "es"
- German: "de"
Any language not listed must be classified as "other" with the code "on".
# Response Format
Your answer must follow this format:
{"language_iso": <language_code>}
# Examples
Below are sample inputs and expected outputs:
## English
User: Hello, how are you?
Answer: {"language_iso": "en"}
## French
User: Bonjour, comment allez-vous?
Answer: {"language_iso": "fr"}
```

```
You are a language detection model, your task is to detect the language of the given text.
# Available Languages
Select the language from the following list:
- English: "en"
- French: "fr"
- Spanish: "es"
- German: "de"
Any language not listed must be classified as "other" with the code "on".
# Response Format
Your answer must follow this format:
{"language_iso": <language_code>}
# Examples
Below are sample inputs and expected outputs:
## English
User: Hello, how are you?
Answer: {"language_iso": "en"}
## French
User: Bonjour, comment allez-vous?
Answer: {"language_iso": "fr"}
```

Formatting

Copy section link
## Formatting

 Formatting is critical for crafting effective prompts. It allows you to **explicitly highlight** different sections, making the structure intuitive for both the model and developers. **Markdown** and/or **XML-style tags** are ideal because they are:
*   **Readable**: Easy for humans to scan.
*   **Parsable**: Simple to extract information programmatically.
*   **Familiar**: Likely seen massively during the model’s training. Good formatting not only helps the model understand the prompt but also makes it **easier for developers to iterate and maintain** the application.

Example Prompting

Copy section link
## Example Prompting

 Example prompting is a technique where you provide a **few task examples** to improve the model’s understanding, accuracy and specially the **output format**.

Few-Shot Prompting

Copy section link
### Few-Shot Prompting

 A specific example of this is **few-shot prompting**, where artificial interactions between the user and model are included in the conversation history. In contrast, **zero-shot prompting** involves no examples. Direct Example in a Prompt:

```
[...]
# Examples
Input: Hello, how are you?
Output: {"language_iso": "en"}
[...]
```

```
[...]
# Examples
Input: Hello, how are you?
Output: {"language_iso": "en"}
[...]
```

Standard Few-Shot Prompting Structure:

```
[
    {
        "role": "system",
        "content": "You are a language detection model. Your task is to detect the language of the given text.\n[...]"
    },
    {
        "role": "user",
        "content": "Hello, how are you?"
    },
    {
        "role": "assistant",
        "content": "{\"language_iso\": \"en\"}"
    },
    {
        "role": "user",
        "content": "Bonjour, comment allez-vous?"
    },
    {
        "role": "assistant",
        "content": "{\"language_iso\": \"fr\"}"
    }
]
```

```
[
    {
        "role": "system",
        "content": "You are a language detection model. Your task is to detect the language of the given text.\n[...]"
    },
    {
        "role": "user",
        "content": "Hello, how are you?"
    },
    {
        "role": "assistant",
        "content": "{\"language_iso\": \"en\"}"
    },
    {
        "role": "user",
        "content": "Bonjour, comment allez-vous?"
    },
    {
        "role": "assistant",
        "content": "{\"language_iso\": \"fr\"}"
    }
]
```

Structured Outputs

Copy section link
## Structured Outputs

 With your prompt ready, you can now focus on the output. To ensure the model generates structured and predictable responses, we provide the ability of enforcing a specific JSON output format. This is particularly useful for tasks requiring a **consistent structure** that can be easily parsed and processed programmatically. If used in the example above, this technique would ensure that the model’s responses are consistent in terms of formating and also allows to enforce the categories to be used. If you are interested, for more details on how to use structured outputs, you can refer to the [Structured Outputs](https://docs.mistral.ai/studio-api/conversations/structured-output) docs.

Advice

Copy section link
## Advice

 When building a prompt, it is important to stay flexible and experiment, different models from different labs, and even a simple update, can change the model behaviour and a consistent prompt may be impacted by these changes. Hence, do not hesitate to revisit your prompts and see the impact, similar to how you would iterate on your code and model training, you should iterate on your prompts and evaluate the impact of your changes.

What to Avoid

Copy section link
# What to Avoid

### What you should Avoid

Below we provide a list of "good to know" advice about what to avoid doing. The list is not exhaustive and can depend on your use case - but these points are good to keep in mind while building your prompts.

Avoid Subjective and Blurry Words

Copy section link
## Avoid Subjective and Blurry Words

*   Avoid blurry quantitative adjectives: “too long”, “too short”, “many”, “few”, etc.
    *   Instead, provide objective measures.

*   Avoid blurry words like “things”, “stuff”, “write an _interesting_ report”, “make it _better_”, etc.
    *   Instead, state exactly what you mean by “interesting”, “better”, etc.

Avoid Contradictions

Copy section link
## Avoid Contradictions

 As your system prompt gets long, slight contradictions may appear.

Example:
*   “If the new data is related to an existing database record, update this record.”
*   “If the data is new, create a new record.”
*   This is unclear because new data could either update an existing record or create a new one.

Instead, use a decision tree:

```
## How to update database records
Follow these steps:
- If the data does not include new information (i.e., it already exists in a record):
    - Ignore this data.
- Otherwise, if the data is not related to any existing record in the same table:
    - Create a new record.
- Otherwise, if the related record is larger than 100 characters:
    - Create a new record.
- Otherwise, if the data directly contradicts the existing record:
    - Delete the existing record and create a new one.
- Otherwise:
    - Update the existing record to include the new data.
```

```
## How to update database records
Follow these steps:
- If the data does not include new information (i.e., it already exists in a record):
    - Ignore this data.
- Otherwise, if the data is not related to any existing record in the same table:
    - Create a new record.
- Otherwise, if the related record is larger than 100 characters:
    - Create a new record.
- Otherwise, if the data directly contradicts the existing record:
    - Delete the existing record and create a new one.
- Otherwise:
    - Update the existing record to include the new data.
```

Do Not Make LLMs Count Words

## Do Not Make LLMs Count Words

*   Avoid: “If the record is too long, split it into multiple records.”
*   Avoid: “If the record is longer than 100 characters, split it into multiple records.”
*   Instead, provide character counts as input:```
Existing records:
  - { record: “User: Alice, Age: 30”, charCount: 15 }
  - { record: “User: Bob, Age: 25”, charCount: 13 }
New data:
  - { data: “User: Charlie, Age: 35”, charCount: 17 }
``` ```
Existing records:
  - { record: “User: Alice, Age: 30”, charCount: 15 }
  - { record: “User: Bob, Age: 25”, charCount: 13 }
New data:
  - { data: “User: Charlie, Age: 35”, charCount: 17 }
```

Do Not Generate Too Many Tokens

## Do Not Generate Too Many Tokens

 Models are faster at ingesting tokens than generating them. If using structured outputs, only ask the model to generate what is strictly necessary.

Bad Examples:
*   Generating full record content for a `NO_OP` operation.
*   Generating an entire book in one shot.

Only generate the update or necessary data.

Prefer Worded Scales

## Prefer Worded Scales

 If you need a model to rate something, use a worded scale for better performance.

**Avoid:**

`“Rate these options on a 1 to 5 scale, 1 being highly irrelevant and 5 being highly relevant.”`

`“Rate these options on a 1 to 5 scale, 1 being highly irrelevant and 5 being highly relevant.”`

**Use:**

```
Rate these options using this scale:
- Very Low: if the option is highly irrelevant
- Low: if the option is not good enough
- Neutral: if the option is not particularly interesting
- Good: if the option is worth considering
- Very Good: for highly relevant options
```

```
Rate these options using this scale:
- Very Low: if the option is highly irrelevant
- Low: if the option is not good enough
- Neutral: if the option is not particularly interesting
- Good: if the option is worth considering
- Very Good: for highly relevant options
```

You can convert this worded scale to a numeric one if needed.

Prompting Examples

Copy section link
# Prompting Examples

 Below we walk you through example prompts showing four different prompting capabilities:
*   Classification
*   Summarization
*   Personalization
*   Evaluation

[![Image 1: Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mistralai/cookbook/blob/main/mistral/prompting/prompting_capabilities.ipynb)

Classification

Summarization

Personalization

Evaluation

Close

Mistral models can easily **categorize text** into distinct classes. Take a customer support bot for a bank as an illustration: we can establish a series of predetermined categories within the prompt and then instruct Mistral AI models to categorize the customer's question accordingly.

In the following example, when presented with the customer inquiry, Mistral AI models correctly categorizes it as "country_support":

User Inquiry: "I am inquiring about the availability of your cards in the EU, as I am a resident of France and am interested in using your cards." Assistant Response: "country_support"

System Prompt

Copy section link
## System Prompt

The classification prompt needed to be carefully designed to ensure that the model correctly categorizes the customer inquiry. For classification purposes, there are 2 main strategies, you could:

*   Ask for the label directly, the model should then answer with a single word or string.
    *   Effective, fast and cheap, this strategy will use the less amount of output tokens but may lack reliability and flexibility.

*   Ask for a json output, the model should then answer with a json object that could be downstream processed easily.
    *   Reliable, flexible and practical, this strategy will generate slightly more tokens but allows for more complex use cases and more flexibility.

Compond Term Output

Json Output

This prompt is designed so the model will answer with a single compond term in very few tokens.

```
You are a bank customer service bot. Your task is to assess customer intent and categorize customer inquiry into one of the predefined categories.

# Categories
The main categories available are the following:
- card_arrival: Inquiries about the arrival of the card, or if it is lost.
- change_pin: Inquiries about changing the pin code of the card.
- exchange_rate: Inquiries about the exchange rate of the card.
- country_support: Inquiries about the countries supported by the card.
- cancel_transfer: Inquiries about canceling a transfer.
- charge_dispute: Inquiries about a charge dispute.

If the text doesn't fit into any of the above categories, classify it as:
- customer_service: Inquiries about customer service in general that do not fit into the previous categories.

# Answer Format
You will only respond with the category among the categories listed above without any explanations or notes, in a single self-contained compound term.

## Examples
Below are some examples of customer inquiries and their corresponding categories, you will receive a new customer inquiry and you will respond with the corresponding category.

User: How do I know if I will get my card, or if it is lost? I am concerned about the delivery process and would like to ensure that I will receive my card as expected. Could you please provide information about the tracking process for my card, or confirm if there are any indicators to identify if the card has been lost during delivery?
Answer: card_arrival
User: I am planning an international trip to Paris and would like to inquire about the current exchange rates for Euros as well as any associated fees for foreign transactions.
Answer: exchange_rate
User: What countries are getting support? I will be traveling and living abroad for an extended period of time, specifically in France and Germany, and would appreciate any information regarding compatibility and functionality in these regions.
Answer: country_support
User: Can I get help starting my computer? I am having difficulty starting my computer,and would appreciate your expertise in helping me troubleshoot the issue.
Answer: customer_service
```

```
You are a bank customer service bot. Your task is to assess customer intent and categorize customer inquiry into one of the predefined categories.

# Categories
The main categories available are the following:
- card_arrival: Inquiries about the arrival of the card, or if it is lost.
- change_pin: Inquiries about changing the pin code of the card.
- exchange_rate: Inquiries about the exchange rate of the card.
- country_support: Inquiries about the countries supported by the card.
- cancel_transfer: Inquiries about canceling a transfer.
- charge_dispute: Inquiries about a charge dispute.

If the text doesn't fit into any of the above categories, classify it as:
- customer_service: Inquiries about customer service in general that do not fit into the previous categories.

# Answer Format
You will only respond with the category among the categories listed above without any explanations or notes, in a single self-contained compound term.

## Examples
Below are some examples of customer inquiries and their corresponding categories, you will receive a new customer inquiry and you will respond with the corresponding category.

User: How do I know if I will get my card, or if it is lost? I am concerned about the delivery process and would like to ensure that I will receive my card as expected. Could you please provide information about the tracking process for my card, or confirm if there are any indicators to identify if the card has been lost during delivery?
Answer: card_arrival
User: I am planning an international trip to Paris and would like to inquire about the current exchange rates for Euros as well as any associated fees for foreign transactions.
Answer: exchange_rate
User: What countries are getting support? I will be traveling and living abroad for an extended period of time, specifically in France and Germany, and would appreciate any information regarding compatibility and functionality in these regions.
Answer: country_support
User: Can I get help starting my computer? I am having difficulty starting my computer,and would appreciate your expertise in helping me troubleshoot the issue.
Answer: customer_service
```
