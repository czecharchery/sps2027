#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'
require 'time'
require 'rexml/document'

GRAPHQL_URL = URI('https://is.czecharchery.cz/graphql')
SEASON_ID = 11 # 2025 / 2026
SEASON_NAME = '2025/2026'

AGE_CATEGORIES = [
  'Žáci U13',
  'Žáci U15',
  'Žákyně U13',
  'Žákyně U15',
  'Kadeti U18',
  'Kadetky U18'
].freeze

DISCIPLINE_KEYS = {
  'Halová lukostřelba' => 'halova',
  'Terčová lukostřelba' => 'tercova',
  'Terénní lukostřelba' => 'terenni',
  '3D lukostřelba' => '3d'
}.freeze

QUERY = <<~GRAPHQL
  query AppPublicDataGrid($name: AppPublicGridName!, $input: DataGridInput!, $filter: AppDataGridExtendedInput!) {
    appPublicDataGrid(name: $name, input: $input, filter: $filter) {
      result
      count
      totalCount
      tabCounts
    }
  }
GRAPHQL

def graphql_post(variables)
  http = Net::HTTP.new(GRAPHQL_URL.host, GRAPHQL_URL.port)
  http.use_ssl = true
  req = Net::HTTP::Post.new(GRAPHQL_URL.request_uri, { 'Content-Type' => 'application/json' })
  req.body = JSON.generate({
    operationName: 'AppPublicDataGrid',
    variables: variables,
    query: QUERY
  })
  res = http.request(req)
  raise "HTTP #{res.code}: #{res.body}" unless res.is_a?(Net::HTTPSuccess)

  JSON.parse(res.body)
end

def match_bucket?(bucket)
  ac = bucket['ageCategory']
  disc = bucket['discipline']
  sr = bucket['shootingRound']
  return false unless AGE_CATEGORIES.include?(ac)

  case disc
  when 'Halová lukostřelba'
    sr == 'H18 / ŽH18'
  when 'Terčová lukostřelba'
    ['ŽWA720', 'WA720'].include?(sr)
  when 'Terénní lukostřelba'
    sr == 'T24 / ŽT24'
  when '3D lukostřelba'
    sr == '3D'
  else
    false
  end
end

def fetch_raw_data(raw_output_path)
  puts "Fetching ranking buckets for season #{SEASON_NAME} (ID #{SEASON_ID})..."
  buckets_resp = graphql_post({
    name: 'public_ranking_bucket',
    input: {
      f: [],
      s: { name: 'discipline', dir: 'asc' },
      page: 0,
      perPage: 1000,
      tab: nil,
      search: ''
    },
    filter: {
      longTermCompetition: nil,
      member: nil,
      racingEvent: nil,
      racingSeason: SEASON_ID,
      racingSubSeason: nil,
      ratingBucket: nil,
      roster: nil
    }
  })

  all_buckets = buckets_resp.dig('data', 'appPublicDataGrid', 'result') || []
  matched_buckets = all_buckets.select { |b| match_bucket?(b) }
  puts "Found #{all_buckets.size} total buckets, #{matched_buckets.size} match youth filter criteria."

  buckets_with_entries = matched_buckets.map.with_index(1) do |bucket, idx|
    puts "[#{idx}/#{matched_buckets.size}] Fetching bucket #{bucket['id']} (#{bucket['discipline']} | #{bucket['division']} | #{bucket['ageCategory']} | #{bucket['shootingRound']})..."
    entries_resp = graphql_post({
      name: 'public_ranking_entry',
      input: {
        f: [],
        s: { name: 'position', dir: 'asc' },
        page: 0,
        perPage: 1000,
        tab: nil,
        search: ''
      },
      filter: {
        longTermCompetition: nil,
        member: nil,
        racingEvent: nil,
        racingSeason: nil,
        racingSubSeason: nil,
        ratingBucket: bucket['id'],
        roster: nil
      }
    })
    entries = entries_resp.dig('data', 'appPublicDataGrid', 'result') || []
    bucket.merge('entries' => entries)
  end

  raw_payload = {
    fetchedAt: Time.now.iso8601,
    season: SEASON_NAME,
    seasonId: SEASON_ID,
    buckets: buckets_with_entries
  }

  File.write(raw_output_path, JSON.pretty_generate(raw_payload))
  puts "Saved raw ranking data (#{buckets_with_entries.size} buckets) to #{raw_output_path}."
end

def parse_pohar_xlsx(xlsx_path)
  return {} unless xlsx_path && File.exist?(xlsx_path)

  ss_xml = `unzip -p "#{xlsx_path}" xl/sharedStrings.xml`
  ss_doc = REXML::Document.new(ss_xml)
  strings = []
  ss_doc.elements.each('sst/si') do |si|
    text = +''
    si.elements.each('.//t') { |t| text << t.text.to_s }
    strings << text
  end

  sheet1_xml = `unzip -p "#{xlsx_path}" xl/worksheets/sheet1.xml`
  s1_doc = REXML::Document.new(sheet1_xml)
  rows = []
  s1_doc.elements.each('worksheet/sheetData/row') do |row|
    vals = []
    row.elements.each('c') do |c|
      t = c.attributes['t']
      v = c.elements['v']&.text
      vals << (t == 's' && v ? strings[v.to_i] : v)
    end
    rows << vals
  end

  pohar_by_club = Hash.new { |h, k| h[k] = {} }

  rows.drop(1).each do |r|
    next if r.compact.empty?

    div, trida, pohlavi, kod, jmeno, klub, prumer, limit, splneno = r
    next if klub.nil? || jmeno.nil? || klub == 'Neregistrovaní'

    avg_val = prumer.to_f.round(1)
    limit_val = limit.to_i
    met_bool = (splneno.to_s.strip.upcase == 'ANO')

    club_archers = pohar_by_club[klub.strip]
    archer_rec = (club_archers[jmeno.strip] ||= {
      name: jmeno.strip,
      limitMet: false,
      bestAverage: 0.0,
      entries: []
    })

    archer_rec[:limitMet] ||= met_bool
    archer_rec[:bestAverage] = [archer_rec[:bestAverage], avg_val].max
    archer_rec[:entries] << {
      division: div.to_s.strip,
      ageClass: trida.to_s.strip,
      gender: pohlavi.to_s.strip,
      code: kod.to_s.strip,
      average: avg_val,
      limit: limit_val,
      met: met_bool
    }
  end

  pohar_by_club.transform_values do |archers_hash|
    archers_hash.values.sort_by do |a|
      [a[:limitMet] ? 0 : 1, -a[:bestAverage], a[:name]]
    end
  end
end

def process_raw_data(raw_input_path, json_out_path, js_out_path, xlsx_path = nil)
  raw = JSON.parse(File.read(raw_input_path))
  buckets = raw['buckets']
  pohar_by_club = parse_pohar_xlsx(xlsx_path)

  # Group by club_id -> member_id
  clubs_map = {}

  buckets.each do |bucket|
    disc_label = bucket['discipline']
    disc_key = DISCIPLINE_KEYS.fetch(disc_label)
    div_key = bucket['division']
    age_cat = bucket['ageCategory']
    shooting_round = bucket['shootingRound']

    (bucket['entries'] || []).each do |entry|
      member = entry['member']
      club = entry['club']
      next unless member && club

      club_id = club['id']
      club_name = club['label']
      club_slug = club['slug']
      next if club_slug == 'neregistrovani' || club_name == 'Neregistrovaní'

      member_id = member['id']
      member_name = member['label']
      member_slug = member['slug']

      contributions = entry['contributions'] || []
      race_count = contributions.size
      next if race_count <= 0

      clubs_map[club_id] ||= {
        id: club_id,
        name: club_name,
        slug: club_slug,
        archers: {}
      }

      archer = (clubs_map[club_id][:archers][member_id] ||= {
        id: member_id,
        name: member_name,
        slug: member_slug,
        ageCategories: [],
        totalRaces: 0,
        divisions: Hash.new(0),
        disciplines: {
          'halova' => 0,
          'tercova' => 0,
          'terenni' => 0,
          '3d' => 0
        },
        rankings: []
      })

      archer[:ageCategories] << age_cat unless archer[:ageCategories].include?(age_cat)
      archer[:totalRaces] += race_count
      archer[:divisions][div_key] += race_count
      archer[:disciplines][disc_key] += race_count
      archer[:rankings] << {
        bucketId: bucket['id'],
        discipline: disc_label,
        division: div_key,
        ageCategory: age_cat,
        shootingRound: shooting_round,
        races: race_count,
        bestValue: entry['value']
      }
    end
  end

  # Filter archers with >= 6 totalRaces and build club metrics
  clubs_list = []

  clubs_map.each_value do |club|
    qualifying_archers = club[:archers].values.select { |a| a[:totalRaces] >= 6 }
    next if qualifying_archers.empty?

    # Sort archers by totalRaces desc, then name asc
    qualifying_archers.sort_by! { |a| [-a[:totalRaces], a[:name]] }

    cup_archers = pohar_by_club[club[:name]] || []

    counts = {
      total6Plus: qualifying_archers.size,
      divRL: qualifying_archers.count { |a| a[:divisions]['RL'].to_i >= 1 },
      divKL: qualifying_archers.count { |a| a[:divisions]['KL'].to_i >= 1 },
      divHL: qualifying_archers.count { |a| a[:divisions]['HL'].to_i >= 1 },
      divTL: qualifying_archers.count { |a| a[:divisions]['TL'].to_i >= 1 },
      discHalova: qualifying_archers.count { |a| a[:disciplines]['halova'].to_i >= 1 },
      discTercova: qualifying_archers.count { |a| a[:disciplines]['tercova'].to_i >= 1 },
      discTerenni: qualifying_archers.count { |a| a[:disciplines]['terenni'].to_i >= 1 },
      disc3D: qualifying_archers.count { |a| a[:disciplines]['3d'].to_i >= 1 },
      cupParticipants: cup_archers.size,
      cupLimitMet: cup_archers.count { |a| a[:limitMet] }
    }

    sps_label = if counts[:total6Plus] >= 10
                  counts[:cupLimitMet] >= 6 ? 'SpS A' : 'SpS B'
                end

    clubs_list << {
      id: club[:id],
      name: club[:name],
      slug: club[:slug],
      spsLabel: sps_label,
      counts: counts,
      archers: qualifying_archers,
      cupArchers: cup_archers
    }
  end

  # Sort clubs descending by counts[:total6Plus] (Column 2), then by name ascending
  clubs_list.sort_by! { |c| [-c[:counts][:total6Plus], c[:name]] }

  output_data = {
    appName: 'SpS 2027',
    season: raw['season'] || SEASON_NAME,
    generatedAt: raw['fetchedAt'] || Time.now.iso8601,
    totalClubs: clubs_list.size,
    totalQualifyingArchers: clubs_list.sum { |c| c[:counts][:total6Plus] },
    totalCupParticipants: clubs_list.sum { |c| c[:counts][:cupParticipants] },
    totalCupLimitMet: clubs_list.sum { |c| c[:counts][:cupLimitMet] },
    bucketCount: buckets.size,
    clubs: clubs_list
  }

  json_str = JSON.pretty_generate(output_data)
  File.write(json_out_path, json_str)
  File.write(js_out_path, "window.SPS_DATA = #{json_str};\n")

  puts "Processed #{clubs_list.size} clubs with #{output_data[:totalQualifyingArchers]} qualifying youth archers (>= 6 races)."
  puts "Cup participants: #{output_data[:totalCupParticipants]} (limit met: #{output_data[:totalCupLimitMet]})."
  puts "Wrote #{json_out_path} and #{js_out_path}."
end

mode = ARGV[0] || '--all'
raw_file = File.expand_path('raw_rankings_2025_2026.json', __dir__)
xlsx_file = File.expand_path('SPS2027_Pohar_Data.xlsx', __dir__)
json_file = File.expand_path('data.json', __dir__)
js_file = File.expand_path('data.js', __dir__)

case mode
when '--fetch'
  fetch_raw_data(raw_file)
when '--process'
  process_raw_data(raw_file, json_file, js_file, xlsx_file)
else
  fetch_raw_data(raw_file)
  process_raw_data(raw_file, json_file, js_file, xlsx_file)
end
