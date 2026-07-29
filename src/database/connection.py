from neo4j import GraphDatabase

# Connection credentials
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "DeployFest2026!")

def verify_connection():
    # Initialize the driver
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    try:
        # Verify connectivity
        driver.verify_connectivity()
        print("✅ Successfully connected to Neo4j Database!")
        
        # Let's create our first Node (Charles Leclerc) to test it
        with driver.session() as session:
            session.run(
                """
                MERGE (d:Driver {name: $driver_name})
                SET d.team = 'Ferrari', d.number = 16
                """, 
                driver_name="Charles Leclerc"
            )
            print("✅ Successfully created 'Driver' node for Charles Leclerc.")
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
    finally:
        driver.close()

if __name__ == "__main__":
    verify_connection()