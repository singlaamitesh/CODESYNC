"""
Retrieve stage: embed the query and pull the top-K most similar chunks from
the vector store, scoped to the user's workspace.
"""
from app.modules.chat.retrieval import embeddings as emb
from ..context import RagContext


async def retrieve(ctx: RagContext) -> None:
    ctx.retrieved = await emb.search(
        ctx.query,
        workspace_id=ctx.workspace_id or None,
        limit=ctx.top_k,
    )
