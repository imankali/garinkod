"""Reusable OpenAPI annotations for legacy function-based API views.

Most of this project predates DRF generic views, so spectacular cannot infer a
serializer from the view class.  Applying this baseline annotation keeps every
operation in the protected schema while endpoint-specific decorators can supply
richer request/response serializers as those contracts evolve.
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema


documented_api = extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
)
