# -*- coding: utf-8 -*-
"""
Created on Thu Oct 27 10:50:36 2016

@author: kcarnold
"""

import glob
import json
import pandas as pd
#%%
by_annotator = {n[5::-5]: json.load(open(n)) for n in glob.glob('data/*.json')}
#%%
text_key = pd.read_csv('analysis/text_key.csv')
#%%
question_responses = [dict(item=q['id'], annotator=k, text_idx=text_idx, response=response)
    for k, v in by_annotator.items()
    for q in v['questions']
    for text_idx, response in enumerate(q['responses'])
    if response is not None]
merged_responses = pd.merge(text_key, pd.DataFrame(question_responses),
         left_on='seq', right_on='text_idx', how='right',
)
merged_responses.to_csv('analysis/question_responses_2.csv')
#%%
chars_per_topic = [dict(annotator=annotator, item=topic['name'], text_idx=text_idx, chars=sum(b-a for a, b in ranges))
    for annotator, v in by_annotator.items()
    for topic in v['topics']
    for text_idx, ranges in enumerate(topic['ranges'])
    if len(ranges)]
#%%
from nltk.metrics.agreement import AnnotationTask
def interval_distance(a, b):
    return pow(a-b, 2)

def agreement_metrics(annotation_obj):
    return {method: getattr(annotation_obj, method)() for method in 'alpha'.split()} # weighted_kappa S pi

agreement_by_question = {
     question: agreement_metrics(AnnotationTask(data=[
            (x['annotator'], x['text_idx'], x['response']) for x in question_responses
            if x['item'] == question], distance=interval_distance))
     for question in merged_responses.item.unique()}
#%%
questions_task.alpha()
