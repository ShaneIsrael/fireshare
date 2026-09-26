"""The browser-facing codec string for a video stream.

A browser can only say whether it will play a file smoothly when it is told
exactly what the file is: `navigator.mediaCapabilities.decodingInfo()` takes an
RFC 6381 codec string such as `avc1.640033` or `av01.0.13M.08`, not a codec
name. The player asks before it picks which quality to start on, so a 1440p60
AV1 source does not become the default on a device that has to decode it in
software and falls seconds behind its own audio.

Built from the ffprobe stream entry already stored in `VideoInfo.info`. Anything
that cannot be described with confidence returns None, and the player then
keeps its old behaviour of starting on the source.
"""
import re

# ffprobe's H.264 profile names, to profile_idc and the constraint byte.
_H264_PROFILES = {
    'baseline': (0x42, 0x00),
    'constrained baseline': (0x42, 0xE0),
    'main': (0x4D, 0x00),
    'extended': (0x58, 0x00),
    'high': (0x64, 0x00),
    'constrained high': (0x64, 0x00),
    'progressive high': (0x64, 0x00),
    'high 10': (0x6E, 0x00),
    'high 10 intra': (0x6E, 0x00),
    'high 4:2:2': (0x7A, 0x00),
    'high 4:2:2 intra': (0x7A, 0x00),
    'high 4:4:4': (0xF4, 0x00),
    'high 4:4:4 predictive': (0xF4, 0x00),
    'high 4:4:4 intra': (0xF4, 0x00),
    'cavlc 4:4:4': (0x2C, 0x00),
    'cavlc 4:4:4 intra': (0x2C, 0x00),
}

# ffprobe's HEVC profile names, to general_profile_idc and the compatibility
# flags written in reverse bit order, as RFC 6381 wants them.
_HEVC_PROFILES = {
    'main': (1, 0x6),
    'main 10': (2, 0x4),
    'main still picture': (3, 0x2),
    'rext': (4, 0x10),
}

_AV1_PROFILES = {
    'main': 0,
    'high': 1,
    'professional': 2,
}

# AV1 levels (seq_level_idx) with their MaxPicSize, MaxHSize, MaxVSize and
# MaxDisplayRate from Annex A of the AV1 spec, smallest first. Used only when
# ffprobe did not report a level.
_AV1_LEVELS = [
    (0, 147456, 2048, 1152, 4423680),
    (1, 278784, 2816, 1584, 8363520),
    (4, 665856, 4352, 2448, 19975680),
    (5, 1065024, 5504, 3096, 31950720),
    (8, 2359296, 6144, 3456, 70778880),
    (9, 2359296, 6144, 3456, 141557760),
    (12, 8912896, 8192, 4352, 267386880),
    (13, 8912896, 8192, 4352, 534773760),
    (14, 8912896, 8192, 4352, 1069547520),
    (15, 8912896, 8192, 4352, 1069547520),
    (16, 35651584, 16384, 8704, 1069547520),
    (17, 35651584, 16384, 8704, 2139095040),
    (18, 35651584, 16384, 8704, 4278190080),
    (19, 35651584, 16384, 8704, 4278190080),
]
_AV1_DEFINED_LEVELS = {level for level, *_ in _AV1_LEVELS}


def _int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _framerate(stream):
    raw = stream.get('avg_frame_rate') or stream.get('r_frame_rate') or ''
    try:
        num, den = raw.split('/')
        rate = float(num) / float(den)
    except (ValueError, ZeroDivisionError):
        return None
    return rate if rate > 0 else None


def _bit_depth(stream):
    match = re.search(r'p(\d+)(le|be)?$', stream.get('pix_fmt') or '')
    if match:
        return int(match.group(1))
    return _int(stream.get('bits_per_raw_sample')) or 8


def _av1_level_for(width, height, fps):
    """The smallest AV1 level whose limits hold this picture size and rate."""
    if not width or not height:
        return None
    pixels = width * height
    rate = pixels * (fps or 30)
    for level, max_pic, max_h, max_v, max_rate in _AV1_LEVELS:
        if pixels <= max_pic and width <= max_h and height <= max_v and rate <= max_rate:
            return level
    return None


def _h264(stream):
    profile = _H264_PROFILES.get((stream.get('profile') or '').lower())
    level = _int(stream.get('level'))
    if not profile or not level or level <= 0:
        return None
    profile_idc, constraints = profile
    return f"avc1.{profile_idc:02X}{constraints:02X}{level:02X}"


def _hevc(stream):
    profile = _HEVC_PROFILES.get((stream.get('profile') or '').lower())
    level = _int(stream.get('level'))
    if not profile or not level or level <= 0:
        return None
    tag = stream.get('codec_tag_string')
    tag = tag if tag in ('hvc1', 'hev1') else 'hvc1'
    profile_idc, compat = profile
    # ffprobe does not report the tier. Main tier covers everything a game
    # recorder or phone produces.
    return f"{tag}.{profile_idc}.{compat:X}.L{level}.B0"


def _av1(stream):
    profile_name = (stream.get('profile') or '').lower()
    if profile_name in _AV1_PROFILES:
        profile = _AV1_PROFILES[profile_name]
    elif (stream.get('pix_fmt') or '').startswith(('yuv420', 'gray')):
        profile = 0
    else:
        return None

    level = _int(stream.get('level'))
    if level not in _AV1_DEFINED_LEVELS:
        level = _av1_level_for(_int(stream.get('width')), _int(stream.get('height')),
                               _framerate(stream))
    if level is None:
        return None

    depth = _bit_depth(stream)
    if depth not in (8, 10, 12):
        return None
    # As with HEVC, the tier is not reported; Main is the one in practice.
    return f"av01.{profile}.{level:02d}M.{depth:02d}"


_BUILDERS = {
    'h264': _h264,
    'hevc': _hevc,
    'av1': _av1,
}


def codec_string(stream):
    """The RFC 6381 codec string for an ffprobe video stream, or None."""
    if not stream:
        return None
    build = _BUILDERS.get((stream.get('codec_name') or '').lower())
    return build(stream) if build else None


def stream_bitrate(stream):
    """The stream's bitrate in bits per second, when the container records one."""
    if not stream:
        return None
    rate = _int(stream.get('bit_rate'))
    return rate if rate and rate > 0 else None
