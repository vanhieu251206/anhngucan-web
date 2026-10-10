#!/usr/bin/env bash
# Bước 2 của "Nén lại audio cũ" (src/lib/audioRecompress.js): nén mọi file audio trong thư mục đã tải về (0001.mp3...)
# xuống 64 kbps mono, ghi vào thư mục con "nen/" GIỮ NGUYÊN SỐ. File vốn đã nhẹ (<= 80 kbps) thì bỏ qua.
# Dùng: bash scripts/nen-audio.sh "<thư mục đã tải về>"
set -u
dir="${1:?Thiếu đường dẫn thư mục audio}"
mkdir -p "$dir/nen"
done_n=0; skip_n=0; fail_n=0
for f in "$dir"/*.{mp3,wav,m4a,ogg,aac,flac,opus}; do
  [ -f "$f" ] || continue
  n="$(basename "${f%.*}")"
  out="$dir/nen/$n.mp3"
  [ -s "$out" ] && { done_n=$((done_n+1)); continue; }
  br="$(ffprobe -v error -show_entries format=bit_rate -of csv=p=0 "$f" 2>/dev/null)"
  if [ -n "$br" ] && [ "$br" != "N/A" ] && [ "$br" -le 80000 ]; then skip_n=$((skip_n+1)); continue; fi
  if ffmpeg -v error -y -i "$f" -vn -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k "$out"; then
    done_n=$((done_n+1))
  else
    rm -f "$out"; fail_n=$((fail_n+1)); echo "LOI: $f"
  fi
done
echo "Da nen: $done_n · Bo qua (da nhe): $skip_n · Loi: $fail_n"
du -ch "$dir"/*.* 2>/dev/null | tail -1; du -ch "$dir/nen"/*.mp3 2>/dev/null | tail -1
