from rest_framework import status
from rest_framework.exceptions import APIException


class LocationNotFound(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "No place matched that text."
    default_code = "location_not_found"


class RouteNotFound(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "No truck route found between these places."
    default_code = "route_not_found"


class InvalidDeparture(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "That departure time cannot be planned."
    default_code = "invalid_departure"


class UpstreamServiceError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "A weather or routing service is unavailable. Try again."
    default_code = "upstream_unavailable"
