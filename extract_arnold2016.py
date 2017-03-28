import json
import pandas as pd
import random
import cytoolz

rs = random.Random(0)

arnold16 = pd.read_csv('arnold16_full_participant_data.csv')
arnold16_filtered = arnold16[arnold16.idx >= 2]

pairs = []
# key = []
grouped_by_participant = json.loads(arnold16_filtered.set_index(['participant_id', 'condition']).reviewText.unstack().to_json(orient='index'))
for participant_id, texts in grouped_by_participant.items():
    order = rs.sample('pw', 2)
    pairs.append([(dict(participant_id=participant_id, cond=cond, text=texts[cond])) for cond in order])
    # key.append([dict( for cond in order])

data = [{
        "pages": partition,
        "attrs": ["food", "drinks", "atmosphere", "service", "value"],
        } for i, partition in enumerate(cytoolz.partition_all(4, pairs))]

pd.DataFrame(dict(data=[json.dumps(d) for d in data[:1]])).to_csv('input_data_just1.csv', index=False)
pd.DataFrame(dict(data=[json.dumps(d) for d in data])).to_csv('input_data.csv', index=False)
