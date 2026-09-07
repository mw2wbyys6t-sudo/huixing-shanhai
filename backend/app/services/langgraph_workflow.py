"""
LangGraph 官方库实现的多 Agent 工作流
使用 StateGraph 构建：意图解析 → 并行执行 → 结果汇聚 → 质量评估 → 反馈循环
"""
import asyncio
import json
import time
import operator
from typing import TypedDict, List, Dict, Any, Optional, Annotated
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.deepseek_client import deepseek_client


# ==================== 状态定义 ====================
class WorkflowState(TypedDict):
    """工作流共享状态（黑板模式）"""
    user_input: str
    session_id: str
    intent: str
    intent_confidence: float
    extracted_entities: Dict[str, Any]
    # 使用 Annotated + operator.or_ 实现字典合并，避免并行执行冲突
    agent_results: Annotated[Dict[str, Dict[str, Any]], operator.or_]
    final_output: str
    quality_score: float
    feedback_rounds: int
    errors: Annotated[List[str], operator.add]
    start_time: float
    total_time: float


# ==================== Agent 节点实现 ====================
async def intent_node(state: WorkflowState) -> WorkflowState:
    """意图解析节点"""
    print(f"[LangGraph] 执行意图解析节点...")
    start = time.time()

    try:
        prompt = f"""分析以下用户旅行需求的意图类型，并提取关键实体。

用户输入：{state['user_input']}

意图类型（只能选一个）：
- destination_recommend: 目的地推荐
- itinerary_planning: 行程规划
- avoid_analysis: 避雷分析
- weather_query: 天气查询
- budget_planning: 预算规划
- general_query: 通用查询

请严格按照以下JSON格式回复：
{{
  "intent": "意图类型",
  "confidence": 0.0-1.0,
  "entities": {{
    "destination": "目的地（如有）",
    "days": 天数（如有）,
    "budget": 预算（如有）,
    "travelers": "出行人数（如有）",
    "season": "季节/时间（如有）"
  }}
}}"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅行意图解析专家，只输出JSON格式。",
            temperature=0.1,
            max_tokens=500,
        )

        # 解析 JSON
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()

            result = json.loads(response)
            intent = result.get("intent", "general_query")
            confidence = result.get("confidence", 0.5)
            entities = result.get("entities", {})
        except (json.JSONDecodeError, ValueError):
            intent = "general_query"
            confidence = 0.3
            entities = {}

        state["intent"] = intent
        state["intent_confidence"] = confidence
        state["extracted_entities"] = entities
        state["agent_results"]["intent"] = {
            "success": True,
            "content": f"意图: {intent}, 置信度: {confidence:.2f}",
            "execution_time": time.time() - start,
        }

    except Exception as e:
        state["errors"].append(f"意图解析失败: {str(e)[:50]}")
        state["agent_results"]["intent"] = {
            "success": False,
            "error": str(e),
            "execution_time": time.time() - start,
        }

    # 只返回更新的字段，避免并行执行冲突
    return {
        "intent": state["intent"],
        "intent_confidence": state["intent_confidence"],
        "extracted_entities": state["extracted_entities"],
        "agent_results": state["agent_results"],
        "errors": state["errors"],
    }


async def weather_node(state: WorkflowState) -> WorkflowState:
    """天气适配节点"""
    print(f"[LangGraph] 执行天气适配节点...")
    start = time.time()
    destination = state["extracted_entities"].get("destination", "")

    if not destination:
        return {
            "agent_results": {
                "weather": {
                    "success": True,
                    "content": "未指定目的地，跳过天气分析",
                    "execution_time": time.time() - start,
                }
            }
        }

    try:
        prompt = f"""分析{destination}的旅游天气特点和最佳旅游时间。

请提供：
1. 当前季节的天气特点
2. 最佳旅游时间
3. 天气注意事项
4. 室内/室外活动建议

简洁回答，不超过200字。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅游天气分析师。",
            temperature=0.3,
            max_tokens=300,
        )

        return {
            "agent_results": {
                "weather": {
                    "success": True,
                    "content": response,
                    "execution_time": time.time() - start,
                }
            }
        }

    except Exception as e:
        return {
            "agent_results": {
                "weather": {
                    "success": False,
                    "error": str(e),
                    "execution_time": time.time() - start,
                }
            }
        }


async def attraction_node(state: WorkflowState) -> WorkflowState:
    """景点推荐节点"""
    print(f"[LangGraph] 执行景点推荐节点...")
    start = time.time()
    destination = state["extracted_entities"].get("destination", "")

    if not destination:
        return {
            "agent_results": {
                "attraction": {
                    "success": True,
                    "content": "未指定目的地，跳过景点推荐",
                    "execution_time": time.time() - start,
                }
            }
        }

    try:
        days = state["extracted_entities"].get("days", 3)
        prompt = f"""推荐{destination}适合{days}天行程的必去景点。

请推荐5-8个景点，每个景点包含：
- 景点名称
- 推荐理由（一句话）
- 建议游玩时间
- 避雷提示

简洁回答。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅游景点推荐专家。",
            temperature=0.5,
            max_tokens=500,
        )

        return {
            "agent_results": {
                "attraction": {
                    "success": True,
                    "content": response,
                    "execution_time": time.time() - start,
                }
            }
        }

    except Exception as e:
        return {
            "agent_results": {
                "attraction": {
                    "success": False,
                    "error": str(e),
                    "execution_time": time.time() - start,
                }
            }
        }


async def budget_node(state: WorkflowState) -> WorkflowState:
    """预算管控节点"""
    print(f"[LangGraph] 执行预算管控节点...")
    start = time.time()
    budget = state["extracted_entities"].get("budget")
    destination = state["extracted_entities"].get("destination", "")
    days = state["extracted_entities"].get("days", 3)

    if not budget and not destination:
        return {
            "agent_results": {
                "budget": {
                    "success": True,
                    "content": "未指定预算和目的地，跳过预算分析",
                    "execution_time": time.time() - start,
                }
            }
        }

    try:
        prompt = f"""为{destination}{days}天行程做预算规划。

预算：{budget if budget else '未指定，给出参考预算'}元

请提供：
1. 预算分配明细（交通/住宿/餐饮/门票/其他）
2. 省钱建议
3. 性价比推荐

简洁回答，不超过300字。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅行预算规划专家。",
            temperature=0.3,
            max_tokens=400,
        )

        return {
            "agent_results": {
                "budget": {
                    "success": True,
                    "content": response,
                    "execution_time": time.time() - start,
                }
            }
        }

    except Exception as e:
        return {
            "agent_results": {
                "budget": {
                    "success": False,
                    "error": str(e),
                    "execution_time": time.time() - start,
                }
            }
        }


async def avoid_node(state: WorkflowState) -> WorkflowState:
    """避雷分析节点"""
    print(f"[LangGraph] 执行避雷分析节点...")
    start = time.time()
    destination = state["extracted_entities"].get("destination", "")

    if not destination:
        return {
            "agent_results": {
                "avoid": {
                    "success": True,
                    "content": "未指定目的地，跳过避雷分析",
                    "execution_time": time.time() - start,
                }
            }
        }

    try:
        prompt = f"""分析{destination}旅游的常见陷阱和避雷点。

请提供：
1. 主要避雷点（3-5个）
2. 防骗建议
3. 最佳游览时间（避开人流）

简洁回答，不超过300字。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅游避雷分析专家，专门识别旅游陷阱。",
            temperature=0.3,
            max_tokens=400,
        )

        return {
            "agent_results": {
                "avoid": {
                    "success": True,
                    "content": response,
                    "execution_time": time.time() - start,
                }
            }
        }

    except Exception as e:
        return {
            "agent_results": {
                "avoid": {
                    "success": False,
                    "error": str(e),
                    "execution_time": time.time() - start,
                }
            }
        }


async def itinerary_node(state: WorkflowState) -> WorkflowState:
    """行程规划节点（结果汇聚）"""
    print(f"[LangGraph] 执行行程规划节点（结果汇聚）...")
    start = time.time()

    try:
        # 汇聚所有 Agent 的结果
        context_parts = []
        for name, result in state["agent_results"].items():
            if name != "intent" and result.get("success") and result.get("content"):
                context_parts.append(f"【{name.upper()}】\n{result['content']}")

        context = "\n\n".join(context_parts)

        prompt = f"""根据以下多 Agent 分析结果，为用户生成完整的旅行规划。

用户需求：{state['user_input']}

提取的实体：{json.dumps(state['extracted_entities'], ensure_ascii=False)}

多 Agent 分析结果：
{context}

请生成：
1. 行程概览
2. 逐日详细安排（上午/下午/晚上）
3. 预算分配
4. 避雷提示
5. 实用建议

要求：结构清晰，内容实用，直接回答用户需求。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅行规划师，擅长整合多方面信息生成完整行程。",
            temperature=0.5,
            max_tokens=1500,
        )

        state["final_output"] = response
        state["agent_results"]["itinerary"] = {
            "success": True,
            "content": response,
            "execution_time": time.time() - start,
        }

    except Exception as e:
        state["errors"].append(f"行程生成失败: {str(e)[:50]}")
        state["agent_results"]["itinerary"] = {
            "success": False,
            "error": str(e),
            "execution_time": time.time() - start,
        }

    return state


async def validator_node(state: WorkflowState) -> WorkflowState:
    """验证冲突节点（质量评估）"""
    print(f"[LangGraph] 执行质量评估节点...")
    start = time.time()

    try:
        prompt = f"""评估以下旅行规划的质量，给出0-10分的评分。

用户需求：{state['user_input']}

生成的规划：
{state['final_output'][:2000]}

评估维度：
1. 完整性（是否覆盖用户所有需求）
2. 准确性（信息是否真实可靠）
3. 实用性（是否可直接执行）
4. 避雷提示（是否有足够的风险提醒）
5. 结构清晰度

请严格按照以下JSON格式回复：
{{
  "score": 0-10,
  "completeness": "完整性评价",
  "issues": ["存在的问题1", "问题2"],
  "suggestions": ["改进建议1", "建议2"]
}}"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个严格的旅行规划质量评估专家，只输出JSON格式。",
            temperature=0.1,
            max_tokens=500,
        )

        # 解析 JSON
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()

            result = json.loads(response)
            state["quality_score"] = float(result.get("score", 5.0))
        except (json.JSONDecodeError, ValueError):
            state["quality_score"] = 6.0

        state["agent_results"]["validator"] = {
            "success": True,
            "content": f"质量评分: {state['quality_score']:.1f}/10",
            "execution_time": time.time() - start,
        }

    except Exception as e:
        state["quality_score"] = 6.0
        state["agent_results"]["validator"] = {
            "success": False,
            "error": str(e),
            "execution_time": time.time() - start,
        }

    return state


async def revise_node(state: WorkflowState) -> WorkflowState:
    """修订节点（反馈循环）"""
    print(f"[LangGraph] 执行修订节点（第{state['feedback_rounds'] + 1}轮）...")
    start = time.time()

    try:
        prompt = f"""根据以下反馈修订旅行规划。

用户需求：{state['user_input']}

当前规划（需要改进）：
{state['final_output'][:1500]}

质量评分：{state['quality_score']:.1f}/10（低于7分，需要修订）

请改进规划，重点解决：
1. 补充缺失的信息
2. 提高实用性和可执行性
3. 增加避雷提示
4. 优化结构清晰度

直接输出修订后的完整规划。"""

        response = await deepseek_client.chat_completion(
            user_message=prompt,
            system_prompt="你是一个专业的旅行规划师，擅长根据反馈优化行程。",
            temperature=0.4,
            max_tokens=1500,
        )

        state["final_output"] = response
        state["feedback_rounds"] += 1

    except Exception as e:
        state["errors"].append(f"修订失败: {str(e)[:50]}")

    return state


# ==================== 条件路由 ====================
def route_after_validator(state: WorkflowState) -> str:
    """验证后的条件路由：评分>=7结束，否则修订"""
    if state["quality_score"] >= 7.0 or state["feedback_rounds"] >= 2:
        return "end"
    return "revise"


# ==================== 构建工作流图 ====================
def build_workflow():
    """构建 LangGraph 工作流图"""
    workflow = StateGraph(WorkflowState)

    # 添加节点
    workflow.add_node("intent", intent_node)
    workflow.add_node("weather", weather_node)
    workflow.add_node("attraction", attraction_node)
    workflow.add_node("budget", budget_node)
    workflow.add_node("avoid", avoid_node)
    workflow.add_node("itinerary", itinerary_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("revise", revise_node)

    # 设置入口
    workflow.set_entry_point("intent")

    # 意图解析后，根据意图并行执行专业 Agent
    # 简化：所有意图都执行 weather/attraction/budget/avoid（未指定目的地的会自动跳过）
    workflow.add_edge("intent", "weather")
    workflow.add_edge("intent", "attraction")
    workflow.add_edge("intent", "budget")
    workflow.add_edge("intent", "avoid")

    # 所有专业 Agent 完成后，汇聚到行程规划
    workflow.add_edge("weather", "itinerary")
    workflow.add_edge("attraction", "itinerary")
    workflow.add_edge("budget", "itinerary")
    workflow.add_edge("avoid", "itinerary")

    # 行程规划后，质量评估
    workflow.add_edge("itinerary", "validator")

    # 质量评估后，条件路由
    workflow.add_conditional_edges(
        "validator",
        route_after_validator,
        {
            "revise": "revise",
            "end": END,
        },
    )

    # 修订后，重新评估
    workflow.add_edge("revise", "validator")

    # 使用内存检查点（支持状态持久化）
    memory = MemorySaver()

    return workflow.compile(checkpointer=memory)


# 全局工作流实例
langgraph_workflow = build_workflow()


async def run_langgraph_workflow(user_input: str, session_id: str = None) -> WorkflowState:
    """
    执行 LangGraph 工作流

    Args:
        user_input: 用户输入
        session_id: 会话ID（用于检查点）

    Returns:
        工作流最终状态
    """
    import uuid
    if not session_id:
        session_id = f"session_{uuid.uuid4().hex[:12]}"

    initial_state: WorkflowState = {
        "user_input": user_input,
        "session_id": session_id,
        "intent": "general_query",
        "intent_confidence": 0.0,
        "extracted_entities": {},
        "agent_results": {},
        "final_output": "",
        "quality_score": 0.0,
        "feedback_rounds": 0,
        "errors": [],
        "start_time": time.time(),
        "total_time": 0.0,
    }

    config = {"configurable": {"thread_id": session_id}}

    # 执行工作流
    final_state = await langgraph_workflow.ainvoke(initial_state, config)

    # 计算总时间
    final_state["total_time"] = time.time() - final_state["start_time"]

    print(f"[LangGraph] 工作流执行完成，总时间: {final_state['total_time']:.2f}s")
    print(f"[LangGraph] 意图: {final_state['intent']}, 质量评分: {final_state['quality_score']:.1f}")

    return final_state
