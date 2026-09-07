"""
测试多 Agent 工作流 API
"""
import requests
import json

print("测试多 Agent 工作流 API...")
print("请求: 带父母去云南5天，预算8000")
print()

try:
    response = requests.post(
        'http://127.0.0.1:8000/api/workflow/plan',
        json={'message': '带父母去云南5天，预算8000', 'max_feedback_rounds': 1},
        timeout=120
    )
    data = response.json()

    print("=== 工作流执行结果 ===")
    print(f"意图: {data['intent']} (置信度: {data['intent_confidence']:.2f})")
    print(f"提取实体: {json.dumps(data['extracted_entities'], ensure_ascii=False)}")
    print(f"质量评分: {data['quality_score']:.1f}/10")
    print(f"反馈循环轮次: {data['feedback_rounds']}")
    print(f"执行 Agent 数量: {data['agent_count']}")
    print()
    print("=== Agent 执行情况 ===")
    for agent in data['agents']:
        status = '✓' if agent['success'] else '✗'
        print(f"  {status} {agent['name']}: {agent['execution_time']:.2f}s")
    print()
    print("=== 最终行程规划（前500字）===")
    print(data['final_output'][:500])
    print("...")

except Exception as e:
    print(f"测试失败: {str(e)}")
    import traceback
    traceback.print_exc()
