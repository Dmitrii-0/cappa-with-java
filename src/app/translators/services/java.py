# src/app/translators/services/java.py
import json
from django.conf import settings
from app.translators.enums import TranslatorType
from app.translators.services.base import BaseTranslatorService

JAVA_PROJECT_MARKER = 'CAPPA_PROJECT_V1'

class JavaService(BaseTranslatorService):
    SERVICE_HOST = settings.SERVICES_HOSTS[TranslatorType.JAVA]

    @classmethod
    def _parse_code(cls, code: str) -> dict:
        """Разбирает code: если CAPPA_PROJECT_V1 → multi, иначе → single."""
        if code.startswith(JAVA_PROJECT_MARKER):
            try:
                project = json.loads(code[len(JAVA_PROJECT_MARKER):].strip())
                files = project.get('files', [])
                if files:
                    return {
                        'mode': 'multi',
                        'files': files,
                        'mainclass': None,  # sandbox сам найдёт main по public class
                    }
            except (json.JSONDecodeError, KeyError):
                pass
        return {'mode': 'single', 'files': None, 'mainclass': None}

    @classmethod
    def debug(cls, code: str, **kwargs) -> ...:
        parsed = cls._parse_code(code)
        if parsed['mode'] == 'multi':
            payload = {
                'mode': 'multi',
                'files': parsed['files'],
                'mainclass': parsed['mainclass'],
                'datain': kwargs.get('datain'),
            }
            # Для multi — code не нужен, sandbox берёт files
            # Но sandbox ожидает mainclass; определим по public static void main
            main_file = next(
                (f['name'].replace('.java', '').replace('/', '.')
                 for f in parsed['files']
                 if 'public static void main' in f.get('content', '')),
                'Main'
            )
            payload['mainclass'] = main_file
        else:
            payload = {
                'mode': 'single',
                'code': code,
                'datain': kwargs.get('datain'),
            }
        response = cls.perform_request(
            url=f'{cls.SERVICE_HOST}/debug',
            data=payload,
        )
        from app.translators.services.serializers import ResponseDebugSerializer
        from rest_framework.serializers import ValidationError
        from app.common.services import exceptions
        slz = ResponseDebugSerializer(data=response.json())
        try:
            slz.is_valid(raise_exception=True)
        except ValidationError as ex:
            raise exceptions.ServiceInvalidResponse(detail={'error': str(ex)})
        return slz.validated_data
