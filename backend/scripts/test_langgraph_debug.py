"""
测试 LangGraph 工作流 API - 调试版
"""
import requests
import json

print("测试 LangGraph 工作流 API...")
print("请求: 带父母去云南5天，预算8000")
print()

try:
    response = requests.post(
        'http://127.0.0.1:8000/api/workflow/langgraph',
        json={'message': '带父母去云南5天，预算8000'},
        timeout=120
    )
    print(f"HTTP状态码: {response.status_code}")
    print()

    data = response.json()
    print("=== 完整响应数据 ===")
    print(json.dumps(data, ensure_ascii=False, indent=2)[:2000])
    print()

    if 'detail' in data:
        print(f"错误详情: {data['detail']}")

except Exception as e:
    print(f"测试失败: {str(e)}")
    import traceback
    traceback.print_exc()
