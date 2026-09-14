Cumulus
=======
Cumulus lets me unify my daily workflow that currently utilizes llm-wiki + Obsidian + trello. I have attention problems, and the goal of this tool
is to help me be able to split up work up into actionable items, journal, commit to daily routines, and give a unified space where LLMs can
retain knowledge for future work. It is presented in a highly graphical and interactive manner to keep my interest and make this fun.


** Overview **
* Root record is "domain". Examples of domains are "personal", "work", and "church"
  * Domains have a title and a theme color associated with them that is used to help differentiate the different domains in the UI
  * Domains are split into tabs
  * I switch between domains as I have different blocks of time to work each
    * For example: I mainly focus on the "work" domain during work hours
    * I mainly work on "church" domain on sundays and thursday evenings (set aside time for church responsibilities)
    * personal would be worked on at different times
    * I can switch between them whenever I want

* Domains are split into functional sections
  * Cloud
    * Display of clusters in cloud
    * Search clusters and underlying nodes
  * Inbox
    * Inbox is landing spot for ideas as they come for further refinement and prioritization
  * Focus
    * Location for focusing blocks of time on work, single ordered list. Works like a pretty standard TODO list
  * Journal
    * Daily journal records are created to give overview on thoughts for the day, able to link to clusters

* Clusters are tied to a domain
  * They have a title
  * They are displayed in a cloud of nodes after being opened 
  * They help to broadly separate out groups of work, projects, etc. They roughly relate to how I use a list in trello:
  * Examples of clusters:
    * Books to read
    * Household projects
    * Food ideas
    * Movies and shows to watch
    * Software projects
    * Outside projects

* Clusters have nodes
  * nodes can be todo items, or topics (standing areas of work that are never simply "done")
  * nodes have a markdown description
  * nodes can have notes
  * nodes can have attachments (see below)
  * nodes are roughtly equivalent to "cards" in trello
  * nodes can carry their own memory (see below), so a card is also a memory construct

* Memory
  * Based roughly on LLM-WIKI pattern, but normalized into a relational database and made more visual
  * Memory is primarily written by LLMs via MCP, but can also be created and edited manually
  * Memory has two halves:
    * Knowledge entries: what is currently known
    * Events: what happened, in order

* Knowledge entries
  * The general knowledge roll-up: the active entries in a cluster are what an LLM knows about that cluster
  * Most entries hold exactly one thing, so each can be updated, replaced, or retired on its own:
    * Decision - a choice that was made
    * Fact - something observed or established to be true
    * Preference - how I want something done
    * Procedure - steps or checks that worked and should be repeated
    * Reference - where something lives (a doc, dashboard, repo, system, or contact)
    * Question - an open question, closed by replacing it with an entry that answers it
  * Synthesis entries are the exception: a maintained write-up that pulls together everything known about one subject,
    like an LLM-WIKI page. They are the readable overview that sits on top of the single-thing entries
  * Entries have a short title and a one-line description
    * LLMs read an index of titles and descriptions first, and only load the full entries that look relevant, so
      memory does not flood their context
  * Entries have a markdown body, plus optional:
    * Rationale - why it is true or was chosen, so an LLM can handle cases the entry didn't anticipate
    * Alternatives - what was considered and rejected
    * How to apply - when and how an LLM should act on it
  * Entries and events can be tagged
  * Entries are never silently overwritten
    * Every change is kept as a revision, so I can see how understanding changed over time
    * When understanding changes, a new entry supersedes the old one, and the old one stays in history
  * Entries can link to each other, and to the events they draw on, with [[wiki links]]
  * Entries track how often LLMs recall them, and when they were last verified as still true
  * Entries written by an LLM start as pending until I accept or reject them
    * Rejected entries are kept, so an LLM can see the idea was already turned down
  * Entries are displayed in the cloud alongside nodes

* Events
  * An append-only timeline of what happened
    * LLM work sessions: what was done and what was learned
    * Things that happened or arrived: a meeting, a release, a batch of commits, a design document
  * Events record which knowledge entries they created, changed, or superseded
  * Events record where they came from: which LLM, its session, and a related commit, link, or document
  * Events are not reviewed, since they are a record rather than a claim

* Memory scope
  * Knowledge entries and events belong to a node, a cluster, a domain, or are global
  * Global memory is for things true of me across every domain, for example how I like work broken down

* Attachments
  * Images, documents, and links can be attached to nodes, knowledge entries, and events
  * An attachment is either a file Cumulus stores, or a link to something stored elsewhere
  * Attachments can carry a text description so an LLM can use them without loading the file

* Clusters have multiple views
  * cloud
    * Display nodes
    * Also display knowledge entries
  * cards
    * roughly equates to trello view
    * cards can be prioritized (now, next, someday)
    * cards can also be ordered by priority within lists
  * memory
    * visually rich, timeline based interaction with memory to see what LLM retains as knowledge
    * Timeline of events and of changes to knowledge entries
    * The current knowledge roll-up, with pending entries waiting for review


** Notes on the "cloud" interaction **
* Clusters and nodes should be fluid and visually interesting like the "osmos" video game
* Navigation through cloud should be natural with pan and zoom
* Clusters and nodes should be draggable, and physical interaction between entities should be physically simulated
* Rendering should be fast and fluid


** Technology Stack **
Cumulus is a web application that will initially just run directly on my laptop, with the potential to be deployed
to a full online tech stack in the future.

* Node + npm
* Typescript + ESLint + typescript-eslint
* TRPC + Prisma + nextjs
* Postgresql + JSON export / import for database backup and portability
* React + MUI
* Sigma.js for cloud views
* MCP with tool calling for reading and writing all records
  * Memory tools are shaped for LLM use: read the index for a scope, search, load full entries, record an event
    together with the knowledge changes it made, and check a scope for stale or contradictory entries
* Docker image for building and deploying to production, running directly from code in development
* All text is assumed to be saved in markdown format for rich content display

** Claude Design Mockup **
  * A claude design mockup is provided in the `mockup` subdirectory to give a baseline idea of interaction
  * Claude design mockup should be used for reference only, all functionality should be implemented from scratch

** Local Development **
* Use the installed postgres server for local development
* Use natively running node, instead of relying on docker
* Docker should be used for deploying to prod environemnt only
* An importer loads my real data (a Trello board export and an LLM-WIKI project) so the app can be checked against it
  while we iterate
  * Personal data and the config that maps it live in the git-ignored `data` directory

** Open Questions **
* How does an LLM session know which cluster it is working in? For example, mapping a repo path to a cluster
* Should knowledge be consolidated by the LLM that writes it, by a periodic background pass, or both?
