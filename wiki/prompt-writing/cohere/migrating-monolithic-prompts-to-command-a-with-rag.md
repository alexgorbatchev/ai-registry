---
created_on: "2026-04-19 17:41"
source_url: "https://docs.cohere.com/page/migrating-prompts"
title: "Migrating Monolithic Prompts to Command A with RAG"
provider: "cohere"
published: "unavailable"
date_status: "sitemap_lastmod"
source_date: "2026-04-03T15:30:36.619Z"
source_date_type: "sitemap_lastmod"
date_note: "Cohere's sitemap exposed lastmod metadata, but the page fetch did not expose a publication date."
downloaded_at: "2026-04-19"
---

# Migrating Monolithic Prompts to Command A with RAG

Command A is a powerful LLM optimized for long context tasks such as retrieval augmented generation (RAG). Migrating a monolithic task such as question-answering or query-focused summarization to RAG can improve the quality of responses due to reduced hallucination and improved conciseness through grounding.

Previously, migrating an existing use case to RAG involved a lot of manual work around indexing documents, implementing at least a basic search strategy, extensive post-processing to introduce proper grounding through citations, and of course fine-tuning an LLM to work well in the RAG paradigm.

This cookbook demonstrates automatic migration of monolithic prompts through two diverse use cases where an original prompt is broken down into two parts: (1) context; and (2) instructions. The former can be done automatically or through simple chunking, while the latter is done automatically by Command A through single shot prompt optimization.

The two use cases demonstrated here are:

1.   Autobiography Assistant; and
2.   Legal Question Answering

1#!pip install cohere

1 import json
2 import os
3 import re
4
5 import cohere
6 import getpass

1 CO_API_KEY = getpass.getpass('cohere API key:')

1 co = cohere.Client(CO_API_KEY)

## Autobiography Assistant

This application scenario is a common LLM-as-assistant use case: given some context, help the user to complete a task. In this case, the task is to write a concise autobiographical summary.

1 original_prompt = '''## information
2 Current Job Title: Senior Software Engineer
3 Current Company Name: GlobalSolTech
4 Work Experience: Over 15 years of experience in software engineering, specializing in AI and machine learning. Proficient in Python, C++, and Java, with expertise in developing algorithms for natural language processing, computer vision, and recommendation systems.
5 Current Department Name: AI Research and Development
6 Education: B.Sc. in Physics from Trent University (2004), Ph.D. in Statistics from HEC in Paris (2010)
7 Hobbies: I love hiking in the mountains, free diving, and collecting and restoring vintage world war one mechanical watches.
8 Family: Married with 4 children and 3 grandchildren.
9
10## instructions
11 Your task is to assist a user in writing a short biography for social media.
12 The length of the text should be no more than 100 words.
13 Write the summary in first person.'''

1 response = co.chat(
2 message=original_prompt,
3 model='command-a-03-2025',
4)

1 print(response.text)

Using Command A, we can automatically upgrade the original prompt to a RAG-style prompt to get more faithful adherence to the instructions, a clearer and more concise prompt, and in-line citations for free. Consider the following meta-prompt:

1 meta_prompt = f'''Below is a task for an LLM delimited with ## Original Task. Your task is to split that task into two parts: (1) the context; and (2) the instructions.
2 The context should be split into several separate parts and returned as a JSON object where each part has a name describing its contents and the value is the contents itself.
3 Make sure to include all of the context contained in the original task description and do not change its meaning.
4 The instructions should be re-written so that they are very clear and concise. Do not change the meaning of the instructions or task, just make sure they are very direct and clear.
5 Return everything in a JSON object with the following structure:
6
7{{
8"context": [{{"<description 1="" of="" part="">": "<content 1="" of="" part="">"}}, ...],
9"instructions": "<the instructions="" re-written="">"
10}}
11
12## Original Task
13{original_prompt}
14'''

1 print(meta_prompt)

Command A returns with the following:

1 upgraded_prompt = co.chat(
2 message=meta_prompt,
3 model='command-a-03-2025',
4)

1 print(upgraded_prompt.text)

To extract the returned information, we will write two simple functions to post-process out the JSON and then parse it.

1 def get_json(text: str) -> str:
2 matches = [m.group(1) for m in re.finditer("```([\w\W]*?)```", text)]
3 if len(matches):
4 postproced = matches[0]
5 if postproced[:4] == 'json':
6 return postproced[4:]
7 return postproced
8 return text

1 def get_prompt_and_docs(text: str) -> tuple:
2 json_obj = json.loads(get_json(text))
3 prompt = json_obj['instructions']
4 docs = []
5 for item in json_obj['context']:
6 for k,v in item.items():
7 docs.append({"title": k, "snippet": v})
8 return prompt, docs

1 new_prompt, docs = get_prompt_and_docs(upgraded_prompt.text)

1 new_prompt, docs

As we can see above, the new prompt is much more concise and gets right to the point. The context has been split into 4 “documents” that Command A can ground the information to. Now let’s run the same task with the new prompt while leveraging the `documents=` parameter. Note that the `docs` variable is a list of dict objects with `title` describing the contents of a text and `snippet` containing the text itself:

1 response = co.chat(
2 message=new_prompt,
3 model='command-a-03-2025',
4 documents=docs,
5)

1 print(response.text)

The response is concise. More importantly, we can ensure that there is no hallucination because the text is automatically grounded in the input documents. Using the simple function below, we can add this grounding information to the text as citations:

1 def insert_citations(text: str, citations: list[dict], add_one: bool=False):
2"""
3 A helper function to pretty print citations.
4"""
5 offset = 0
6# Process citations in the order they were provided
7 for citation in citations:
8# Adjust start/end with offset
9 start, end = citation.start + offset, citation.end + offset
10 if add_one:
11 cited_docs = [str(int(doc[4:]) + 1) for doc in citation.document_ids]
12 else:
13 cited_docs = [doc[4:] for doc in citation.document_ids]
14# Shorten citations if they're too long for convenience
15 if len(cited_docs) > 3:
16 placeholder = "[" + ", ".join(cited_docs[:3]) + "...]"
17 else:
18 placeholder = "[" + ", ".join(cited_docs) + "]"
19# ^ doc[4:] removes the 'doc_' prefix, and leaves the quoted document
20 modification = f'{text[start:end]} {placeholder}'
21# Replace the cited text with its bolded version + placeholder
22 text = text[:start] + modification + text[end:]
23# Update the offset for subsequent replacements
24 offset += len(modification) - (end - start)
25
26 return text

1 print(insert_citations(response.text, response.citations, True))

Now let’s move on to an arguably more difficult problem.

## Legal Question Answering

On March 21st, the DOJ announced that it is [suing Apple](https://www.theverge.com/2024/3/21/24107659/apple-doj-lawsuit-antitrust-documents-suing) for anti-competitive practices. The [complaint](https://www.justice.gov/opa/media/1344546/dl) is 88 pages long and consists of about 230 paragraphs of text. To understand what the suit alleges, a common use case would be to ask for a summary. Because Command A has a context window of 256K, even an 88-page legal complaint fits comfortably within the window.

1 apple = open('data/apple_mod.txt').read()

1 tokens = co.tokenize(text=apple, model='command-a-03-2025')
2 len(tokens.tokens)

We can set up a prompt template that allows us to ask questions on the original text.

1 prompt_template = '''
2{legal_text}
3
4{question}
5'''

1 question = '''Please summarize the attached legal complaint succinctly. Focus on answering the question: what does the complaint allege?'''
2 rendered_prompt = prompt_template.format(legal_text=apple, question=question)

1 response = co.chat(
2 message=rendered_prompt,
3 model='command-a-03-2025',
4 temperature=0.3,
5)

1 print(response.text)

The summary seems clear enough. But we are interested in the specific allegations that the DOJ makes. For example, skimming the full complaint, it looks like the DOJ is alleging that Apple could encrypt text messages sent to Android phones if it wanted to do so. We can amend the rendered prompt and ask:

1 question = '''Does the DOJ allege that Apple could encrypt text messages sent to Android phones?'''
2 rendered_prompt = prompt_template.format(legal_text=apple, question=question)

1 response = co.chat(
2 message=rendered_prompt,
3 model='command-a-03-2025',
4)

1 print(response.text)

This is a very interesting allegation that at first glance suggests that the model could be hallucinating. Because RAG has been shown to help reduce hallucinations and grounds its responses in the input text, we should convert this prompt to the RAG style paradigm to gain confidence in its response.

While previously we asked Command A to chunk the text for us, the legal complaint is highly structured with numbered paragraphs so we can use the following function to break the complaint into input docs ready for RAG:

1 def chunk_doc(input_doc: str) -> list:
2 chunks = []
3 current_para = 'Preamble'
4 current_chunk = ''
5# pattern to find an integer number followed by a dot (finding the explicitly numbered paragraph numbers)
6 pattern = r'^\d+\.$'
7
8 for line in input_doc.splitlines():
9 if re.match(pattern, line):
10 chunks.append((current_para.replace('.', ''), current_chunk))
11 current_chunk = ''
12 current_para = line
13 else:
14 current_chunk += line + '\n'
15
16 docs = []
17 for chunk in chunks:
18 docs.append({"title": chunk[0], "snippet": chunk[1]})
19
20 return docs

1 chunks = chunk_doc(apple)

1 print(chunks[18])

1{'title': '18', 'snippet': '\nProtecting competition and the innovation that competition inevitably ushers in\nfor consumers, developers, publishers, content creators, and device manufacturers is why\nPlaintiffs bring this lawsuit under Section 2 of the Sherman Act to challenge Apple’s\nmaintenance of its monopoly over smartphone markets, which affect hundreds of millions of\nAmericans every day. Plaintiffs bring this case to rid smartphone markets of Apple’s\nmonopolization and exclusionary conduct and to ensure that the next generation of innovators\ncan upend the technological world as we know it with new and transformative technologies.\n\n\nII.\n\nDefendant Apple\n\n'}

We can now try the same question but ask it directly to Command A with the chunks as grounding information.

1 response = co.chat(
2 message='''Does the DOJ allege that Apple could encrypt text messages sent to Android phones?''',
3 model='command-a-03-2025',
4 documents=chunks,
5)

1 print(response.text)

The responses seem similar, but we should add citations and check the citation to get confidence in the response.

1 print(insert_citations(response.text, response.citations))

The most important passage seems to be paragraph 144. Paragraph 93 is also cited. Let’s check what they contain.

1 print(chunks[144]['snippet'])

1 print(chunks[93]['snippet'])

Paragraph 144 indeed contains the important allegation: **If Apple wanted to, Apple could allow iPhone users to send encrypted messages to Android users**.

In this cookbook we have shown how one can easily take an existing monolithic prompt and migrate it to the RAG paradigm to get less hallucination, grounded information, and in-line citations. We also demonstrated Command A’s ability to re-write an instruction prompt in a single shot to make it more concise and potentially lead to higher quality completions.
