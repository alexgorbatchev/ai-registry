---
created_on: "2026-04-19 17:41"
source_url: "https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities"
title: "Prompting Capabilities with Mistral AI"
provider: "mistral"
published: "unavailable"
date_status: "unavailable"
source_date: "unavailable"
source_date_type: "unavailable"
date_note: "Mistral's fetched cookbook content did not expose a stable per-page publish or update date."
downloaded_at: "2026-04-19"
---

# Prompting Capabilities with Mistral AI

Prompt Engineering Classification+3

#### Contents

*   [Classification](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#classification)
*   [Strategies we used:](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#strategies-we-used)
*   [Summarization](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#summarization)
*   [Strategies we used:](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#strategies-we-used-1)
*   [Personlization](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#personlization)
*   [Strategies we used:](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#strategies-we-used-2)
*   [Evaluation](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#evaluation)
*   [Include a confidence score](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#include-a-confidence-score)
*   [Strategies we used:](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#strategies-we-used-3)
*   [Introduce an evaluation step](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#introduce-an-evaluation-step)
*   [Employ another LLM for evaluation](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#employ-another-llm-for-evaluation)
*   [Strategies we used:](https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities#strategies-we-used-4)

Go to Top

When you first start using Mistral models, your first interaction will revolve around prompts. The art of crafting effective prompts is essential for generating desirable responses from Mistral models or other LLMs. This guide will walk you through example prompts showing four different prompting capabilities.

*   Classification
*   Summarization
*   Personalization
*   Evaluation

`! pip install mistralai`

`! pip install mistralai`

`from mistralai import Mistral`

`from mistralai import Mistral`

`api_key = "TYPE YOUR API KEY"`

`api_key = "TYPE YOUR API KEY"`

```
def run_mistral(user_message, model="mistral-large-latest"):
    client = Mistral(api_key=api_key)
    messages = [
        {"role":"user", "content":user_message}
    ]
    chat_response = client.chat.complete(
        model=model,
        messages=messages
    )
    return (chat_response.choices[0].message.content)
```

```
def run_mistral(user_message, model="mistral-large-latest"):
    client = Mistral(api_key=api_key)
    messages = [
        {"role":"user", "content":user_message}
    ]
    chat_response = client.chat.complete(
        model=model,
        messages=messages
    )
    return (chat_response.choices[0].message.content)
```

## Classification

Mistral models can easily categorize text into distinct classes. In this example prompt, we can define a list of predefined categories and ask Mistral models to classify user inquiry.

```
def user_message(inquiry):
    user_message = (
        f"""
        You are a bank customer service bot. Your task is to assess customer intent
        and categorize customer inquiry after <<<>>> into one of the following predefined categories:

        card arrival
        change pin
        exchange rate
        country support
        cancel transfer
        charge dispute

        If the text doesn't fit into any of the above categories, classify it as:
        customer service

        You will only respond with the predefined category. Do not include the word "Category". Do not provide explanations or notes.

        ####
        Here are some examples:

        Inquiry: How do I know if I will get my card, or if it is lost? I am concerned about the delivery process and would like to ensure that I will receive my card as expected. Could you please provide information about the tracking process for my card, or confirm if there are any indicators to identify if the card has been lost during delivery?
        Category: card arrival
        Inquiry: I am planning an international trip to Paris and would like to inquire about the current exchange rates for Euros as well as any associated fees for foreign transactions.
        Category: exchange rate
        Inquiry: What countries are getting support? I will be traveling and living abroad for an extended period of time, specifically in France and Germany, and would appreciate any information regarding compatibility and functionality in these regions.
        Category: country support
        Inquiry: Can I get help starting my computer? I am having difficulty starting my computer, and would appreciate your expertise in helping me troubleshoot the issue.
        Category: customer service
        ###

        <<<
        Inquiry: {inquiry}
        >>>
        """
    )
    return user_message
```

```
def user_message(inquiry):
    user_message = (
        f"""
        You are a bank customer service bot. Your task is to assess customer intent
        and categorize customer inquiry after <<<>>> into one of the following predefined categories:

        card arrival
        change pin
        exchange rate
        country support
        cancel transfer
        charge dispute

        If the text doesn't fit into any of the above categories, classify it as:
        customer service

        You will only respond with the predefined category. Do not include the word "Category". Do not provide explanations or notes.

        ####
        Here are some examples:

        Inquiry: How do I know if I will get my card, or if it is lost? I am concerned about the delivery process and would like to ensure that I will receive my card as expected. Could you please provide information about the tracking process for my card, or confirm if there are any indicators to identify if the card has been lost during delivery?
        Category: card arrival
        Inquiry: I am planning an international trip to Paris and would like to inquire about the current exchange rates for Euros as well as any associated fees for foreign transactions.
        Category: exchange rate
        Inquiry: What countries are getting support? I will be traveling and living abroad for an extended period of time, specifically in France and Germany, and would appreciate any information regarding compatibility and functionality in these regions.
        Category: country support
        Inquiry: Can I get help starting my computer? I am having difficulty starting my computer, and would appreciate your expertise in helping me troubleshoot the issue.
        Category: customer service
        ###

        <<<
        Inquiry: {inquiry}
        >>>
        """
    )
    return user_message
```

### Strategies we used:

*   **Few shot learning**: Few-shot learning or in-context learning is when we give a few examples in the prompts, and the LLM can generate corresponding output based on the example demonstrations. Few-shot learning can often improve model performance especially when the task is difficult or when we want the model to respond in a specific manner.
*   **Delimiter**: Delimiters like ### <<<>>> specify the boundary between different sections of the text. In our example, we used ### to indicate examples and <<<>>> to indicate customer inquiry.
*   **Role playing**: Providing LLM a role (e.g., "You are a bank customer service bot.") adds personal context to the model and often leads to better performance.

Python

Output

```
print(run_mistral(user_message(
    "I am inquiring about the availability of your cards in the EU, as I am a resident of France and am interested in using your cards. "
)))
```

```
print(run_mistral(user_message(
    "I am inquiring about the availability of your cards in the EU, as I am a resident of France and am interested in using your cards. "
)))
```

Python

Output

`print(run_mistral(user_message("What's the weather today?")))`

`print(run_mistral(user_message("What's the weather today?")))`

## Summarization

Summarization is a common task for LLMs due to their natural language understanding and generation capabilities. Here is an example prompt we can use to generate interesting questions about an essay and summarize the essay.

```
import requests
response = requests.get('https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt')
essay = response.text
```

```
import requests
response = requests.get('https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt')
essay = response.text
```

```
message = f"""
You are a commentator. Your task is to write a report on an essay.
When presented with the essay, come up with interesting questions to ask, and answer each question.
Afterward, combine all the information and write a report in the markdown format.

# Essay:
{essay}

# Instructions:
## Summarize:
In clear and concise language, summarize the key points and themes presented in the essay.

## Interesting Questions:
Generate three distinct and thought-provoking questions that can be asked about the content of the essay. For each question:
- After "Q: ", describe the problem
- After "A: ", provide a detailed explanation of the problem addressed in the question.
- Enclose the ultimate answer in <>.

## Write a report
Using the essay summary and the answers to the interesting questions, create a comprehensive report in Markdown format.
"""
```

```
message = f"""
You are a commentator. Your task is to write a report on an essay.
When presented with the essay, come up with interesting questions to ask, and answer each question.
Afterward, combine all the information and write a report in the markdown format.

# Essay:
{essay}

# Instructions:
## Summarize:
In clear and concise language, summarize the key points and themes presented in the essay.

## Interesting Questions:
Generate three distinct and thought-provoking questions that can be asked about the content of the essay. For each question:
- After "Q: ", describe the problem
- After "A: ", provide a detailed explanation of the problem addressed in the question.
- Enclose the ultimate answer in <>.

## Write a report
Using the essay summary and the answers to the interesting questions, create a comprehensive report in Markdown format.
"""
```

Python

Output

`print(run_mistral(message))`

`print(run_mistral(message))`

## Strategies we used:

*   **Step-by-step instructions**: This strategy is inspired by the chain-of-thought prompting that enables LLMs to use a series of intermediate reasoning steps to tackle complex tasks. It's often easier to solve complex problems when we decompose them into simpler and small steps and it's easier for us to debug and inspect the model behavior. In our example, we break down the task into three steps: summarize, generate interesting questions, and write a report. This helps the language to think in each step and generate a more comprehensive final report.
*   **Example generation**: We can ask LLMs to automatically guide the reasoning and understanding process by generating examples with the explanations and steps. In this example, we ask the LLM to generate three questions and provide detailed explanations for each question.
*   **Output formatting**: We can ask LLMs to output in a certain format by directly asking "write a report in the Markdown format".

## Personlization

LLMs excel at personalization tasks as they can deliver content that aligns closely with individual users. In this example, we create personalized email responses to address customer questions.

```
email = """
Dear mortgage lender,

What's your 30-year fixed-rate APR, how is it compared to the 15-year fixed rate?

Regards,
Anna
"""
```

```
email = """
Dear mortgage lender,

What's your 30-year fixed-rate APR, how is it compared to the 15-year fixed rate?

Regards,
Anna
"""
```

```
message = f"""

You are a mortgage lender customer service bot, and your task is to create personalized email responses to address customer questions.
Answer the customer's inquiry using the provided facts below. Ensure that your response is clear, concise, and
directly addresses the customer's question. Address the customer in a friendly and professional manner. Sign the email with
"Lender Customer Support."

# Facts
30-year fixed-rate: interest rate 6.403%, APR 6.484%
20-year fixed-rate: interest rate 6.329%, APR 6.429%
15-year fixed-rate: interest rate 5.705%, APR 5.848%
10-year fixed-rate: interest rate 5.500%, APR 5.720%
7-year ARM: interest rate 7.011%, APR 7.660%
5-year ARM: interest rate 6.880%, APR 7.754%
3-year ARM: interest rate 6.125%, APR 7.204%
30-year fixed-rate FHA: interest rate 5.527%, APR 6.316%
30-year fixed-rate VA: interest rate 5.684%, APR 6.062%

# Email
{email}
"""
```

```
message = f"""

You are a mortgage lender customer service bot, and your task is to create personalized email responses to address customer questions.
Answer the customer's inquiry using the provided facts below. Ensure that your response is clear, concise, and
directly addresses the customer's question. Address the customer in a friendly and professional manner. Sign the email with
"Lender Customer Support."

# Facts
30-year fixed-rate: interest rate 6.403%, APR 6.484%
20-year fixed-rate: interest rate 6.329%, APR 6.429%
15-year fixed-rate: interest rate 5.705%, APR 5.848%
10-year fixed-rate: interest rate 5.500%, APR 5.720%
7-year ARM: interest rate 7.011%, APR 7.660%
5-year ARM: interest rate 6.880%, APR 7.754%
3-year ARM: interest rate 6.125%, APR 7.204%
30-year fixed-rate FHA: interest rate 5.527%, APR 6.316%
30-year fixed-rate VA: interest rate 5.684%, APR 6.062%

# Email
{email}
"""
```

Python

Output

`print(run_mistral(message))`

`print(run_mistral(message))`

### Strategies we used:

*   Providing facts: Incorporating facts into prompts can be useful for developing customer support bots. It’s important to use clear and concise language when presenting these facts. This can help the LLM to provide accurate and quick responses to customer queries.

## Evaluation

There are many ways to evaluate LLM outputs. Here are three approaches for your reference: include a confidence score, introduce an evaluation step, or employ another LLM for evaluation.

## Include a confidence score

We can include a confidence score along with the generated output in the prompt.

```
def run_mistral(user_message, model="mistral-large-latest"):
    client = Mistral(api_key=api_key)
    messages = [
        {
            "role":"user",
            "content": user_message
        }
    ]
    chat_response = client.chat.complete(
        model=model,
        messages=messages,
        temperature=1,
        response_format = {
          "type": "json_object"
        }
    )
    return (chat_response.choices[0].message.content)
```

```
def run_mistral(user_message, model="mistral-large-latest"):
    client = Mistral(api_key=api_key)
    messages = [
        {
            "role":"user",
            "content": user_message
        }
    ]
    chat_response = client.chat.complete(
        model=model,
        messages=messages,
        temperature=1,
        response_format = {
          "type": "json_object"
        }
    )
    return (chat_response.choices[0].message.content)
```

```
message = f"""
You are a summarization system that can provide summaries with associated confidence scores.
In clear and concise language, provide three short summaries of the following essay, along with their confidence scores.
You will only respond with a JSON object with the key Summary and Confidence. Do not provide explanations.

# Essay:
{essay}

"""
```

```
message = f"""
You are a summarization system that can provide summaries with associated confidence scores.
In clear and concise language, provide three short summaries of the following essay, along with their confidence scores.
You will only respond with a JSON object with the key Summary and Confidence. Do not provide explanations.

# Essay:
{essay}

"""
```

Python

Output

`print(run_mistral(message))`

`print(run_mistral(message))`

### Strategies we used:

*   JSON output: For facilitating downstream tasks, JSON format output is frequently preferred. We can enable the JSON mode by setting the response_format to `{"type": "json_object"}` and specify in the prompt that “You will only respond with a JSON object with the key Summary and Confidence.” Specifying these keys within the JSON object is beneficial for clarity and consistency.
*   Higher Temperature: In this example, we increase the temperature score to encourage the model to be more creative and output three generated summaries that are different from each other.

## Introduce an evaluation step

We can also add a second step in the prompt for evaluation.

Python

Output

```
message = f"""
You are given an essay text and need to provide summaries and evaluate them.

# Essay:
{essay}

Step 1: In this step, provide three short summaries of the given essay. Each summary should be clear, concise, and capture the key points of the speech. Aim for around 2-3 sentences for each summary.
Step 2: Evaluate the three summaries from Step 1 and rate which one you believe is the best. Explain your choice by pointing out specific reasons such as clarity, completeness, and relevance to the speech content.

"""
print(run_mistral(message))
```

```
message = f"""
You are given an essay text and need to provide summaries and evaluate them.

# Essay:
{essay}

Step 1: In this step, provide three short summaries of the given essay. Each summary should be clear, concise, and capture the key points of the speech. Aim for around 2-3 sentences for each summary.
Step 2: Evaluate the three summaries from Step 1 and rate which one you believe is the best. Explain your choice by pointing out specific reasons such as clarity, completeness, and relevance to the speech content.

"""
print(run_mistral(message))
```

## Employ another LLM for evaluation

In production systems, it is common to employ another LLM for evaluation so that the evaluation step can be separate from the generation step.

*   Step 1: use the first LLM to generate three summaries

```
message = f"""
Provide three short summaries of the given essay. Each summary should be clear, concise, and capture the key points of the essay.
Aim for around 2-3 sentences for each summary.

# essay:
{essay}

"""
summaries = run_mistral(message)
```

```
message = f"""
Provide three short summaries of the given essay. Each summary should be clear, concise, and capture the key points of the essay.
Aim for around 2-3 sentences for each summary.

# essay:
{essay}

"""
summaries = run_mistral(message)
```

Python

Output

`print(summaries)`

`print(summaries)`

*   Step 2: use another LLM to rate the generated summaries

Python

Output

```
message = f"""
You are given an essay and three summaries of the essay. Evaluate the three summaries and rate which one you believe is the best.
Explain your choice by pointing out specific reasons such as clarity, completeness, and relevance to the essay content.

# Essay:
{essay}

# Summaries
{summaries}

"""
print(run_mistral(message))
```

```
message = f"""
You are given an essay and three summaries of the essay. Evaluate the three summaries and rate which one you believe is the best.
Explain your choice by pointing out specific reasons such as clarity, completeness, and relevance to the essay content.

# Essay:
{essay}

# Summaries
{summaries}

"""
print(run_mistral(message))
```

### Strategies we used:

*   **LLM chaining**: In this example, we chain two LLMs in a sequence, where the output from the first LLM serves as the input for the second LLM. The method of chaining LLMs can be adapted to suit your specific use cases. For instance, you might choose to employ three LLMs in a chain, where the output of two LLMs is funneled into the third LLM. While LLM chaining offers flexibility, it's important to consider that it may result in additional API calls and potentially increased costs.
