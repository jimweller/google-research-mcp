graph TD
    %% Main Components
    Client[Client Application] --> PCache[PersistentCache]
    
    %% PersistentCache Components
    PCache --> InMemCache[In-Memory Cache]
    PCache --> PStrategy[Persistence Strategy]
    PCache --> PManager[Persistence Manager]
    
    %% Persistence Strategies
    PStrategy --> Periodic[Periodic Strategy]
    PStrategy --> WriteThrough[Write-Through Strategy]
    PStrategy --> OnShutdown[On-Shutdown Strategy]
    PStrategy --> Hybrid[Hybrid Strategy]
    
    %% Persistence Manager
    PManager --> FileSystem[File System]
    
    %% Styling
    classDef main fill:#f9f,stroke:#333,stroke-width:2px
    classDef component fill:#bbf,stroke:#33f,stroke-width:1px
    classDef strategy fill:#bfb,stroke:#3f3,stroke-width:1px
    classDef storage fill:#fbb,stroke:#f33,stroke-width:1px
    
    class Client,PCache main
    class InMemCache,PStrategy,PManager component
    class Periodic,WriteThrough,OnShutdown,Hybrid strategy
    class FileSystem storage