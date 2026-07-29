from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "DeployFest2026!")

def create_temporal_chain():
    print("⏳ Building chronological [:NEXT_EVENT] relationships...")
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    query = """
    MATCH (e:Event)
    WITH e ORDER BY e.time ASC
    WITH collect(e) AS events
    UNWIND range(0, size(events)-2) AS i
    WITH events[i] AS e1, events[i+1] AS e2
    MERGE (e1)-[:NEXT_EVENT]->(e2)
    """
    
    driver.execute_query(query)
    print("✅ Successfully linked all events chronologically!")
    driver.close()

if __name__ == "__main__":
    create_temporal_chain()