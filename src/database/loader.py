import fastf1
import pandas as pd
from neo4j import GraphDatabase

# --- 1. Discretization Logic ---
print("🏎️ Fetching and discretizing telemetry...")
fastf1.Cache.enable_cache('./f1_cache')
session = fastf1.get_session(2024, 'Monza', 'R')
session.load(telemetry=True, weather=False, messages=False)

corners = session.get_circuit_info().corners[['Number', 'Letter', 'Distance']].copy()
corners['Letter'] = corners['Letter'].fillna('')
corners['Zone_Node'] = "Turn " + corners['Number'].astype(str) + corners['Letter']

# Fixed the deprecation warning by changing pick_driver to pick_drivers
fastest_lap = session.laps.pick_drivers('LEC').pick_fastest()
telemetry = fastest_lap.get_telemetry()[['Time', 'Speed', 'Distance', 'X', 'Y', 'Z', 'Throttle', 'Brake', 'nGear', 'DRS']].copy()

corners = corners.sort_values('Distance')
telemetry = telemetry.sort_values('Distance')

df = pd.merge_asof(telemetry, corners[['Distance', 'Zone_Node']], on='Distance', direction='nearest')

# Clean the data for Neo4j
df['Time_Seconds'] = df['Time'].dt.total_seconds()
df = df.dropna(subset=['Time_Seconds', 'Speed', 'Zone_Node'])
df['X'] = df['X'].fillna(0)
df['Y'] = df['Y'].fillna(0)
df['Z'] = df['Z'].fillna(0)
df['Throttle'] = df['Throttle'].fillna(0)
df['Brake'] = df['Brake'].fillna(0)
df['nGear'] = df['nGear'].fillna(1).astype(int)
df['DRS'] = df['DRS'].fillna(0).astype(int)


# --- 2. Neo4j Loading Logic ---
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "DeployFest2026!")

def load_graph(dataframe):
    print("⏳ Injecting data into Neo4j...")
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    records = dataframe[['Time_Seconds', 'Speed', 'Distance', 'X', 'Y', 'Z', 'Throttle', 'Brake', 'nGear', 'DRS', 'Zone_Node']].to_dict('records')
    
    query = """
    UNWIND $telemetry AS row
    
    MERGE (d:Driver {name: 'Charles Leclerc'})
    MERGE (z:Zone {name: row.Zone_Node})
    
    CREATE (e:Event {
        time: row.Time_Seconds, 
        speed: row.Speed,
        distance: row.Distance,
        x: row.X,
        y: row.Y,
        z: row.Z,
        throttle: row.Throttle,
        brake: row.Brake,
        gear: row.nGear,
        drs: row.DRS
    })
    
    CREATE (d)-[:PERFORMED]->(e)
    CREATE (e)-[:OCCURRED_IN]->(z)
    """
    
    driver.execute_query(query, telemetry=records)
    print(f"✅ Successfully loaded {len(records)} 3D telemetry events into the graph!")
    driver.close()

if __name__ == "__main__":
    sampled_df = df.iloc[::5] 
    load_graph(sampled_df)