from typing import Optional

import requests

from app.common.services import exceptions


class RequestMixin:

    @classmethod
    def perform_request(
        cls,
        url: str,
        data: dict,
        method: str = 'post',
        timeout: Optional[int] = None,
    ) -> requests.Response:
        if method not in ('post', 'get'):
            raise ValueError(f'Unsupported HTTP method: {method!r}')

        try:
            request_kwargs = {'url': url, 'json': data}
            if timeout is not None:
                request_kwargs['timeout'] = timeout
            if method == 'post':
                response = requests.post(**request_kwargs)
            else:
                response = requests.get(**request_kwargs)
        except requests.RequestException as e:
            raise exceptions.ServiceConnectionError(
                details={'error': str(e)}
            )

        if not response.ok:
            try:
                error_body = response.json()
            except Exception:
                error_body = response.text
            raise exceptions.ServiceBadRequest(
                details={
                    'code': response.status_code,
                    'error': error_body,
                }
            )
        return response
