import pandas as pd
from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "DeployFest2026!")

def extract_graph_features():
    print("🔍 Querying Neo4j for sequential features...")
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    # Traverse the graph to calculate speed deltas across sequential events
    query = """
    MATCH (e1:Event)-[:NEXT_EVENT]->(e2:Event)
    MATCH (e1)-[:OCCURRED_IN]->(z:Zone)
    RETURN 
        z.name AS zone_name,
        e1.time AS time_start,
        e1.speed AS speed_start,
        e2.speed AS speed_end,
        (e2.speed - e1.speed) AS speed_delta
    ORDER BY e1.time ASC
    """
    
    records, summary, keys = driver.execute_query(query)
    driver.close()
    
    df = pd.DataFrame(records, columns=keys)
    
    if df.empty:
        print("⚠️ Query returned 0 records! Did you run src/database/link_events.py?")
    else:
        print("✅ Successfully extracted graph features:")
        print(df.head(10))
        
    return df

if __name__ == "__main__":
    extract_graph_features()