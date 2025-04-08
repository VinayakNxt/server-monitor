%%{init: {'theme': 'default'}}%%
flowchart TD
    subgraph "Agent Servers [Multiple Servers]"
        A1[Server 1 Agent]
        A2[Server 2 Agent]
        A3[Server 3 Agent]
        An[... Server N Agent]
    end

    subgraph "Metrics Collection Process"
        A1 --> |Collect Metrics| D1[Supabase PostgreSQL]
        A2 --> |Collect Metrics| D1
        A3 --> |Collect Metrics| D1
        An --> |Collect Metrics| D1
    end

    subgraph "Analysis Server [Single Server]"
        API[Scheduled API Endpoint]
        OpenAI[OpenAI API]
        HTMLGen[HTML Report Generator]
        Mailer[Email Service]
    end

    D1 --> |Retrieve Metrics| API
    API --> |Send Metrics| OpenAI
    OpenAI --> |Generate Analysis| HTMLGen
    HTMLGen --> Mailer
    Mailer --> |Send Report| R[Recipient Email]

    classDef agents fill:#f9f,stroke:#333,stroke-width:2px;
    classDef database fill:#bbf,stroke:#333,stroke-width:2px;
    classDef server fill:#bfb,stroke:#333,stroke-width:2px;

    class A1,A2,A3,An agents;
    class D1 database;
    class API,OpenAI,HTMLGen,Mailer server;