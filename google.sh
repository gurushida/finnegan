#!/bin/bash
echo "Say 'search <foo>' to google for <foo>"
echo

while read line
do
  echo "Input from speech recognition: $line"
  if [[ "$line" =~ ^'???:search ' ]]; then
    echo "yes"
  else
    echo "no"
  fi

  QUERY=`echo "$line" | cut -c 12-`
  echo GOOGLE "$QUERY"
  open "https://google.com/search?q=$QUERY"
done

