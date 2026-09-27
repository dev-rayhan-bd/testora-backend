import { cn } from "@/lib/utils";
import { useGetQuestionsQuery } from "@/store/apis";
import { Loader2 } from "lucide-react";
import { useState } from "react";

function statusClass(status: string) {
  return status.toLowerCase() === "published"
    ? "border-[#d0ecd9] bg-[#e9f8ef] text-[#3ea666]"
    : "border-[#f0dfb9] bg-[#fff3da] text-[#c48a2e]";
}

interface Props {
  selectedQuestionIds?: string[];
  onChange?: (ids: string[]) => void;
}

export default function QuestionLinkingSection({
  selectedQuestionIds = [],
  onChange,
}: Props) {
  const [examType, setExamType] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useGetQuestionsQuery({
    limit: 100,
    examType: examType || undefined,
    subjectName: subjectName || undefined,
    status: status || undefined,
    searchTerm: searchTerm || undefined,
  });

  const questions = data?.data ?? [];

  const handleCheckboxChange = (id: string, checked: boolean) => {
    if (!onChange) return;
    if (checked) {
      onChange([...selectedQuestionIds, id]);
    } else {
      onChange(selectedQuestionIds.filter((qid) => qid !== id));
    }
  };

  return (
    <section className="rounded-lg border border-[#dce7f2] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#3f5f7a]">Question Linking Rules</h3>
      <p className="mb-3 text-xs text-[#90a3b6]">
        Link questions from the Question Bank — no content is duplicated here
      </p>

      <div className="rounded-md border border-[#c8ddf2] bg-[#eaf4fd] p-3">
        <ul className="space-y-1 text-xs text-[#4a7eb8]">
          <li>• Questions are selected from the centralized Question Bank</li>
          <li>• One question can be reused across multiple tests</li>
          <li>• Test Archive stores structure and relationship only</li>
        </ul>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <select
          value={examType}
          onChange={(e) => setExamType(e.target.value)}
          className="rounded-md border border-[#dce7f2] bg-[#f8fbff] px-3 py-2 text-xs text-[#4f6d87] outline-none"
        >
          <option value="">All Categories</option>
          <option value="matura">Matura</option>
          <option value="semi_matura">Semimatura</option>
          <option value="provime">Entrance Exam</option>
        </select>
        <input
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          className="rounded-md border border-[#dce7f2] bg-[#f8fbff] px-3 py-2 text-xs text-[#4f6d87] outline-none"
          placeholder="Filter by Subject..."
        />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-md border border-[#dce7f2] bg-[#f8fbff] px-3 py-2 text-xs text-[#4f6d87] outline-none"
          placeholder="Search question text..."
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-[#dce7f2] bg-[#f8fbff] px-3 py-2 text-xs text-[#4f6d87] outline-none"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-[#dce7f2]">
        <table className="w-full min-w-200 text-left">
          <thead className="bg-[#f3f7fb] text-[11px] font-medium tracking-wide text-[#6f859b] uppercase">
            <tr>
              <th className="px-3 py-2">Use</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Question Test Preview</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Subject / Faculty</th>
              <th className="px-3 py-2">Passage</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-[#90a3b6]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#2f86d8]" />
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-[#90a3b6]">
                  No questions found matching your criteria.
                </td>
              </tr>
            ) : (
              questions.map((row: any) => {
                const isSelected = selectedQuestionIds.includes(row._id);
                return (
                  <tr
                    key={row._id}
                    className="border-b border-[#ecf2f8] text-xs text-[#5e768e] last:border-b-0 hover:bg-[#f8fbff]"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleCheckboxChange(row._id, e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#2f86d8]"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#2f86d8]">{row._id.slice(-6).toUpperCase()}</td>
                    <td className="px-3 py-2 line-clamp-2 max-w-xs" title={row.questionText}>
                      {row.questionText}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.examType?.replace("_", " ")}</td>
                    <td className="px-3 py-2">{row.subjectName || row.facultyName || "—"}</td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        row.passageCode ? "text-[#8468c4]" : "text-[#90a3b6]"
                      )}
                    >
                      {row.passageCode || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                          statusClass(row.status)
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-[#90a3b6]">
        {selectedQuestionIds.length} questions linked to this test
      </p>
    </section>
  );
}
