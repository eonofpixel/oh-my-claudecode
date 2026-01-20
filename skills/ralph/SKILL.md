---
name: ralph
description: Self-referential loop until task completion with architect verification
---

# Ralph Skill

[RALPH - ITERATION {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

## COMPLETION REQUIREMENTS

Before claiming completion, you MUST:
1. Verify ALL requirements from the original task are met
2. Ensure no partial implementations
3. Check that code compiles/runs without errors
4. Verify tests pass (if applicable)

## ARCHITECT VERIFICATION (MANDATORY)

When you believe the task is complete:
1. **First**, spawn Architect to verify your work (ALWAYS pass model explicitly!):
   ```
   Task(subagent_type="oh-my-claudecode:architect", model="opus", prompt="Verify this implementation is complete: [describe what you did]")
   ```

2. **Wait for Architect's assessment**

3. **If Architect approves**: Output `<promise>{{PROMISE}}</promise>`
4. **If Architect finds issues**: Fix them, then repeat verification

DO NOT output the completion promise without Architect verification.

## INSTRUCTIONS

- Review your progress so far
- Continue from where you left off
- When FULLY complete AND Architect verified, output: <promise>{{PROMISE}}</promise>
- Do not stop until the task is truly done

Original task:
{{PROMPT}}
